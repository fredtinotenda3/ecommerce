// src/lib/services/PaynowCallbackService.ts
//
// orchestrates a single inbound Paynow callback (Paynow's
// `resulturl` POST) end to end: validate -> look up Payment -> (if this
// is a genuine, non-duplicate status change) transition Payment and
// Order status -> clear the customer's cart and record the purchase,
// but ONLY on the specific delivery that first confirms payment.
//
// SECURITY: hash validation happens inside `provider.handleCallback`
// (PaynowProvider.handleCallback) BEFORE this file makes any decision —
// it throws `InvalidPaynowCallbackError` on a missing/invalid hash, and
// nothing below that point runs. This file never inspects or trusts a
// raw payload directly; it only ever acts on the already-validated
// `CallbackHandlingResult` the provider returns.
//
// IDEMPOTENCY — two independent layers, per the brief's Critical
// Security Rule #6 ("duplicate callback must NOT create duplicate
// payments/orders, increment inventory, or send duplicate fulfilment
// events"):
//
//   1. Payment: if the Payment is already in the reported status, this
//      is treated as a redelivered/duplicate callback — a pure no-op.
//      No repository write, no order transition, no cart clear, no
//      purchase recording. See `payment.status === result.status` below.
//
//   2. Order/cart/purchases: even on a genuine (non-duplicate) status
//      transition, the cart is only cleared and purchases only recorded
//      when the ORDER was not already `PAID` before this callback. This
//      is deliberately keyed off the ORDER's previous status (not just
//      the payment's), and it can only ever fire once per order because
//      `ORDER_STATUS_TRANSITIONS` (orderStateMachine.ts) has no
//      `PAID -> PAID` transition to re-enter — an order can only
//      transition INTO `PAID` a single time in its lifetime.
//
// Deliberately takes repository/provider INTERFACES as injected deps
// (mirrors PaynowCheckoutService.ts / AdminQueryService.ts), so it's
// unit testable with the existing Fake*Repository / FakePaymentProvider
// fakes — see tests/paynowCallbackService.test.ts.

import type { Order, OrderStatus, Payment, PaymentStatus } from '../domain/types'
import type { PaymentProvider } from '../payments/PaymentProvider'
import type { OrderRepository } from '../repositories/OrderRepository'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import type { UserRepository } from '../repositories/UserRepository'
import { assertValidOrderTransition, assertValidPaymentTransition } from './orderStateMachine'

export class PaynowCallbackPaymentNotFoundError extends Error {
  readonly merchantReference: string

  constructor(merchantReference: string) {
    super(`No Payment found for Paynow merchant reference: ${merchantReference}`)
    this.name = 'PaynowCallbackPaymentNotFoundError'
    this.merchantReference = merchantReference
  }
}

export class PaynowCallbackOrderNotFoundError extends Error {
  readonly orderId: string

  constructor(orderId: string) {
    super(`No Order found for Payment's orderId: ${orderId}`)
    this.name = 'PaynowCallbackOrderNotFoundError'
    this.orderId = orderId
  }
}

export interface PaynowCallbackDeps {
  provider: PaymentProvider
  paymentRepository: PaymentRepository
  orderRepository: OrderRepository
  userRepository: UserRepository
}

export interface PaynowCallbackResult {
  payment: Payment
  order: Order
  /** True when this specific delivery was a no-op because the Payment
   * was already recorded in the reported status (a redelivered/
   * duplicate callback). The route handler should still respond 200
   * either way — see the brief's "duplicate callback must return 200
   * without side effects" requirement. */
  duplicate: boolean
}

/** Maps a Paynow-reported PaymentStatus onto the Order status
 * transition it implies. `undefined` means "no order transition for
 * this payment status" — a `PENDING` report, for instance, doesn't move
 * the order at all (it's already `PENDING_PAYMENT` from creation). */
const ORDER_STATUS_FOR_PAYMENT_STATUS: Partial<Record<PaymentStatus, OrderStatus>> = {
  PAID: 'PAID',
  FAILED: 'PAYMENT_FAILED',
  CANCELLED: 'PAYMENT_CANCELLED',
  REFUNDED: 'REFUNDED',
}

/** Processes one raw inbound Paynow callback payload. `rawPayload`
 * should be the exact request body STRING (see the callback route
 * handler, which deliberately reads the body as text rather than
 * JSON-parsing it) — see PaynowProvider's `normalizeInboundPayload` for
 * why field order matters to hash validation. */
export const processPaynowCallback = async (
  rawPayload: unknown,
  deps: PaynowCallbackDeps,
): Promise<PaynowCallbackResult> => {
  // Throws InvalidPaynowCallbackError on a missing/invalid hash or a
  // malformed payload. Deliberately not caught here — the caller (route
  // handler) is responsible for turning that into an HTTP response, and
  // nothing state-changing below this line ever runs for an invalid
  // callback.
  const result = await deps.provider.handleCallback(rawPayload)

  const payment = await deps.paymentRepository.getByMerchantReference(result.merchantReference)
  if (!payment) {
    throw new PaynowCallbackPaymentNotFoundError(result.merchantReference)
  }

  if (payment.status === result.status) {
    // Redelivered/duplicate callback reporting a status we've already
    // recorded. Idempotent no-op — no repository writes below this
    // point, no order transition, no cart clear/purchase recording.
    const order = await deps.orderRepository.getById(payment.orderId)
    if (!order) {
      throw new PaynowCallbackOrderNotFoundError(payment.orderId)
    }
    return { payment, order, duplicate: true }
  }

  // Validates against PAYMENT_STATUS_TRANSITIONS before writing
  // anything — throws InvalidPaymentTransitionError for a sequence the
  // state machine doesn't allow (e.g. a stale/out-of-order delivery
  // reporting PENDING after we've already recorded PAID).
  assertValidPaymentTransition(payment.status, result.status)

  const updatedPayment = await deps.paymentRepository.updateStatus(payment.id, result.status, {
    providerReference: result.providerReference ?? payment.providerReference ?? undefined,
    metadata: { ...payment.metadata, lastCallbackRaw: result.raw },
  })
  if (!updatedPayment) {
    throw new PaynowCallbackPaymentNotFoundError(result.merchantReference)
  }

  const order = await deps.orderRepository.getById(payment.orderId)
  if (!order) {
    throw new PaynowCallbackOrderNotFoundError(payment.orderId)
  }

  const nextOrderStatus = ORDER_STATUS_FOR_PAYMENT_STATUS[result.status]
  let updatedOrder = order

  if (nextOrderStatus && nextOrderStatus !== order.status) {
    assertValidOrderTransition(order.status, nextOrderStatus)
    updatedOrder = (await deps.orderRepository.updateStatus(order.id, nextOrderStatus)) ?? order

    if (nextOrderStatus === 'PAID') {
      // The one and only moment fulfilment side effects happen: the
      // order's PREVIOUS status (checked above, before this write) was
      // not PAID, and it can never re-enter PAID again for this order
      // (see the state machine), so this block runs at most once per
      // order for its entire lifetime — including across any number of
      // redelivered/duplicate callbacks, which are filtered out by the
      // `payment.status === result.status` check above before ever
      // reaching this line.
      await deps.userRepository.updateCart(order.customerId, [])
      if (order.items.length > 0) {
        await deps.userRepository.appendPurchases(
          order.customerId,
          order.items.map(item => item.productId),
        )
      }
    }
  }

  return { payment: updatedPayment, order: updatedOrder, duplicate: false }
}
