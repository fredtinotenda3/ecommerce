// src/lib/services/StripeOrderService.ts
//
// PHASE 13F-A — orchestrates native Stripe order creation: given an
// authenticated customer id, their SERVER-SIDE cart items, and the id of
// a PaymentIntent already created for that cart (by StripeCheckoutService,
// via /api/checkout/stripe/create-payment-intent — see the Phase 13E
// report), this is the only code path that turns them into an Order +
// Payment for the native Stripe flow. Mirrors PaynowCheckoutService.ts's
// shape (Phase 8), with one deliberate difference: Paynow creates the
// Order FIRST and then asks the provider to initiate payment for it;
// native Stripe's PaymentIntent already exists by the time this runs, so
// this calls `PaymentService.recordProviderInitiatedPayment` instead of
// `initiatePaymentForOrder` (see that method's doc comment for why).
//
// SECURITY: this file adds no pricing logic of its own. Every price
// comes from `OrderService.createOrderFromCart`, which re-fetches every
// product fresh from the database and prices every line item from that
// (see pricing.ts) — it never trusts anything the caller supplies about
// price. Nothing in `CreateNativeStripeOrderInput` carries a price or
// total; `cartItems` is `{ productId, quantity }[]` only, and the caller
// (see src/app/api/orders/native/route.ts) is responsible for having
// read that array from the database, never from client-supplied JSON.
// `paymentIntentId` is accepted from the client (it has to be — the
// client is the only party that knows which PaymentIntent it just
// confirmed), but it never influences price: it is only ever stored
// alongside the server-computed total, and the Stripe webhook
// (StripeWebhookService) independently verifies with Stripe (via
// signature verification) that this PaymentIntent actually succeeded
// before trusting anything about it.
//
// IDEMPOTENCY: if this is called twice for the same PaymentIntent (e.g.
// the client retries after a network blip on the first response), the
// second call returns the SAME Order/Payment pair rather than creating a
// second Order from the same cart — see the `paymentRepository.
// getByProviderReference` check below. This is a different idempotency
// key than `PaymentService`'s own merchant-reference check: that one
// only catches a race on a single already-known Order, whereas this one
// is what actually prevents a duplicate Order/PaymentIntent pair from a
// retried request in the first place.
//
// Deliberately takes `OrderService`/`PaymentService`/`PaymentRepository`
// as injected deps (all already accept repository/provider INTERFACES
// themselves), so this is unit testable end-to-end with the existing
// Fake*Repository fakes, without a live database or a real Stripe
// account — see tests/stripeOrderService.test.ts.

import type { CartItem, Order, Payment } from '../domain/types'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import type { OrderService } from './OrderService'
import type { PaymentService } from './PaymentService'

export class StripeOrderNotFoundForPaymentError extends Error {
  readonly paymentId: string

  constructor(paymentId: string) {
    super(`Payment ${paymentId} references an Order that no longer exists`)
    this.name = 'StripeOrderNotFoundForPaymentError'
    this.paymentId = paymentId
  }
}

export interface StripeOrderDeps {
  orderService: OrderService
  paymentService: PaymentService
  paymentRepository: PaymentRepository
}

export interface CreateNativeStripeOrderInput {
  customerId: string
  /** MUST be read by the caller from a server-side source (the
   * customer's persisted cart) — never accepted verbatim from a request
   * body. See the file header. */
  cartItems: CartItem[]
  /** The Stripe PaymentIntent id the client confirmed payment against.
   * See the file header for why accepting this from the client is safe:
   * it is never used for pricing, only as an opaque reference the
   * webhook later reconciles against Stripe's own signed event data. */
  paymentIntentId: string
}

export interface CreateNativeStripeOrderResult {
  order: Order
  payment: Payment
  /** True when an Order/Payment for this exact `paymentIntentId` already
   * existed (a retried request) — the caller should treat this the same
   * as a fresh creation (200/201, same response shape), not as an error. */
  alreadyExisted: boolean
}

/** Creates the Order (server-priced from the DB, status PENDING_PAYMENT)
 * then records the Payment for the already-created PaymentIntent. Any
 * pricing/availability problem in the cart (OrderService/pricing.ts's
 * `ProductNotPurchasableError`, `EmptyCartError`, `MixedCurrencyCartError`)
 * or currency problem (PaymentService's `UnsupportedCurrencyError`)
 * propagates to the caller rather than being swallowed here — the route
 * handler decides the HTTP status for each. */
export const createNativeStripeOrder = async (
  input: CreateNativeStripeOrderInput,
  deps: StripeOrderDeps,
): Promise<CreateNativeStripeOrderResult> => {
  const existingPayment = await deps.paymentRepository.getByProviderReference(input.paymentIntentId)
  if (existingPayment) {
    const order = await deps.orderService.getById(existingPayment.orderId)
    if (!order) {
      throw new StripeOrderNotFoundForPaymentError(existingPayment.id)
    }
    return { order, payment: existingPayment, alreadyExisted: true }
  }

  // Throws EmptyCartError (from pricing.ts, via OrderService) if
  // cartItems is empty, and ProductNotPurchasableError /
  // MixedCurrencyCartError for anything in the cart that isn't
  // currently a valid, published, single-currency line item.
  const order = await deps.orderService.createOrderFromCart(input.customerId, input.cartItems)

  // Throws UnsupportedCurrencyError if 'stripe' can't settle this
  // order's currency.
  const payment = await deps.paymentService.recordProviderInitiatedPayment(order, {
    providerReference: input.paymentIntentId,
  })

  return { order, payment, alreadyExisted: false }
}
