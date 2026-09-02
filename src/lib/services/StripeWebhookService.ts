// src/lib/services/StripeWebhookService.ts
//
// PHASE 13E — pure Stripe webhook signature verification + event
// classification, with NO Payload dependency. Mirrors
// PaynowCallbackService.ts's shape: verification/parsing logic lives
// here as a plain function taking an injected verifier interface, so
// it's unit testable without a real Stripe account or network call
// (see tests/stripeWebhookService.test.ts). The real Stripe SDK's
// `Stripe.webhooks.constructEvent` wiring lives in
// src/app/_api/stripeCheckoutNative.ts.
//
// SCOPE NOTE: the two webhook handlers this phase is decoupling
// (src/payload/stripe/webhooks/priceUpdated.ts, productUpdated.ts) sync
// Stripe's product/price catalog INTO Payload's `products` collection's
// `priceJSON` field. The native `Product` domain type's own doc comment
// already marks that field's native equivalent (`legacyPriceJSON`) as
// "never read by new business logic for pricing decisions" —
// `price`/`currency` are the sole authoritative source now (see
// StripeCheckoutService.ts's header comment, and pricing.ts). Re-
// implementing that catalog sync natively would restore exactly the
// Stripe-as-source-of-truth-for-pricing dependency the migration has
// been removing since Phase 1B, so this file deliberately does NOT
// reproduce `price.updated`/`product.updated` catalog syncing.
//
// What IS reproduced here, decoupled from Payload: signature
// verification (byte-for-byte the same security property Payload's
// `@payloadcms/plugin-stripe` gave the old webhook, since both
// ultimately call the Stripe SDK's own `constructEvent`) and event
// classification, for the events actually relevant to the native
// checkout path this phase adds (`payment_intent.*`).
//
// PHASE 13F-A — now that native Stripe order creation
// (StripeOrderService.ts, /api/orders/native) gives every native Stripe
// checkout a Payment record keyed by PaymentIntent id, this file also
// reconciles a verified `payment_intent.*` event against that record:
// `reconcileStripePaymentIntentEvent` looks the Payment up by
// `providerReference` (== the PaymentIntent id — see
// PaymentRepository.getByProviderReference), transitions Payment/Order
// status, and — on the FIRST delivery that confirms payment (and only
// then) — clears the customer's cart and records the purchase. This
// mirrors PaynowCallbackService.ts's reconciliation logic field-for-
// field (same two-layer idempotency: a redelivered event reporting a
// status we've already recorded is a pure no-op; an order can only ever
// transition into PAID once, per ORDER_STATUS_TRANSITIONS).

import type { Order, OrderStatus, Payment, PaymentStatus } from '../domain/types'
import type { OrderRepository } from '../repositories/OrderRepository'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import type { UserRepository } from '../repositories/UserRepository'
import { assertValidOrderTransition, assertValidPaymentTransition } from './orderStateMachine'

export class StripeWebhookConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeWebhookConfigError'
  }
}

export class StripeWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StripeWebhookSignatureError'
  }
}

/** Structural subset of Stripe's own `Stripe.Event` type — kept minimal
 * and local so this file never needs to import the `stripe` package
 * (only the route handler / gateway wiring does). */
export interface StripeEventLike {
  id: string
  type: string
  data: {
    object: Record<string, unknown>
  }
}

/** Thin seam over `Stripe.webhooks.constructEvent` — lets this service
 * be tested with a fake that returns/throws deterministically, instead
 * of needing a real signed payload. */
export interface StripeWebhookVerifier {
  constructEvent(rawBody: string, signature: string, secret: string): StripeEventLike
}

export interface StripeWebhookHandlingResult {
  eventId: string
  eventType: string
  /** True for event types this phase actually classifies as
   * checkout-relevant (see PAYMENT_INTENT_EVENT_TYPES below). False for
   * anything else (e.g. `product.updated` — see the file header) — the
   * event was still signature-verified and is safely ignored, not an
   * error. */
  handled: boolean
  /** PHASE 13F-A — `event.data.object.id`, extracted only when `handled`
   * is true (i.e. only for `payment_intent.*` events this phase acts
   * on). This is what `reconcileStripePaymentIntentEvent` looks the
   * Payment up by. Undefined for unhandled event types, or if the
   * verified event's payload didn't carry a string `id` (defensive —
   * should not happen for a genuine `payment_intent.*` event). */
  paymentIntentId?: string
}

const PAYMENT_INTENT_EVENT_TYPES = new Set([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
])

export const processStripeWebhookEvent = (
  rawBody: string,
  signature: string | null,
  deps: { verifier: StripeWebhookVerifier; webhookSecret: string | undefined },
): StripeWebhookHandlingResult => {
  if (!deps.webhookSecret) {
    throw new StripeWebhookConfigError('STRIPE_WEBHOOKS_SIGNING_SECRET is not configured')
  }

  if (!signature) {
    throw new StripeWebhookSignatureError('Missing Stripe-Signature header')
  }

  let event: StripeEventLike
  try {
    event = deps.verifier.constructEvent(rawBody, signature, deps.webhookSecret)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Invalid Stripe webhook signature'
    throw new StripeWebhookSignatureError(message)
  }

  const handled = PAYMENT_INTENT_EVENT_TYPES.has(event.type)
  const objectId = event.data.object.id
  const paymentIntentId = handled && typeof objectId === 'string' ? objectId : undefined

  return {
    eventId: event.id,
    eventType: event.type,
    handled,
    paymentIntentId,
  }
}

// ---------------------------------------------------------------------------
// PHASE 13F-A — reconciliation
// ---------------------------------------------------------------------------

export class StripePaymentNotFoundError extends Error {
  readonly providerReference: string

  constructor(providerReference: string) {
    super(`No Payment found for Stripe PaymentIntent: ${providerReference}`)
    this.name = 'StripePaymentNotFoundError'
    this.providerReference = providerReference
  }
}

export class StripeOrderNotFoundError extends Error {
  readonly orderId: string

  constructor(orderId: string) {
    super(`No Order found for Payment's orderId: ${orderId}`)
    this.name = 'StripeOrderNotFoundError'
    this.orderId = orderId
  }
}

export interface StripeWebhookReconciliationDeps {
  paymentRepository: PaymentRepository
  orderRepository: OrderRepository
  userRepository: UserRepository
}

export interface StripeWebhookReconciliationResult {
  payment: Payment
  order: Order
  /** True when this specific delivery was a no-op because the Payment
   * was already recorded in the reported status (a redelivered/
   * duplicate webhook event). The route handler should still respond
   * 2xx either way — Stripe retries indefinitely on a non-2xx response,
   * and retrying a duplicate would be pointless. */
  duplicate: boolean
}

/** Maps a reconciled `payment_intent.*` event type onto the Payment/
 * Order status transition it implies. Only event types this phase
 * classifies as `handled` (see PAYMENT_INTENT_EVENT_TYPES above) have an
 * entry — `reconcileStripePaymentIntentEvent` returns `null` for
 * anything else rather than attempting a lookup. */
const OUTCOME_FOR_EVENT_TYPE: Record<
  string,
  { paymentStatus: PaymentStatus; orderStatus: OrderStatus } | undefined
> = {
  'payment_intent.succeeded': { paymentStatus: 'PAID', orderStatus: 'PAID' },
  'payment_intent.payment_failed': { paymentStatus: 'FAILED', orderStatus: 'PAYMENT_FAILED' },
  'payment_intent.canceled': { paymentStatus: 'CANCELLED', orderStatus: 'PAYMENT_CANCELLED' },
}

/** Reconciles ONE verified `payment_intent.*` event against the Payment
 * native Stripe order creation recorded for it (see StripeOrderService.ts).
 * Call this only after `processStripeWebhookEvent` has already verified
 * the event's signature — this function trusts `eventType`/
 * `paymentIntentId` completely, the same way PaynowCallbackService trusts
 * only an already-validated `CallbackHandlingResult`.
 *
 * Returns `null` (not an error) for an event type this phase doesn't
 * reconcile — the caller should treat that the same as `handled: false`.
 *
 * IDEMPOTENCY — same two-layer guarantee as PaynowCallbackService:
 *   1. Payment: if the Payment is already in the reported status, this
 *      is treated as a redelivered/duplicate event — a pure no-op. No
 *      repository write, no order transition, no cart clear.
 *   2. Order/cart/purchases: even on a genuine (non-duplicate) status
 *      transition, the cart is only cleared and purchases only recorded
 *      when the ORDER was not already `PAID` before this event —
 *      `ORDER_STATUS_TRANSITIONS` has no `PAID -> PAID` transition to
 *      re-enter, so this can only ever fire once per order. */
export const reconcileStripePaymentIntentEvent = async (
  eventType: string,
  paymentIntentId: string,
  deps: StripeWebhookReconciliationDeps,
): Promise<StripeWebhookReconciliationResult | null> => {
  const outcome = OUTCOME_FOR_EVENT_TYPE[eventType]
  if (!outcome) {
    return null
  }

  const payment = await deps.paymentRepository.getByProviderReference(paymentIntentId)
  if (!payment) {
    throw new StripePaymentNotFoundError(paymentIntentId)
  }

  if (payment.status === outcome.paymentStatus) {
    // Redelivered/duplicate event reporting a status we've already
    // recorded — idempotent no-op, no writes below this point.
    const order = await deps.orderRepository.getById(payment.orderId)
    if (!order) {
      throw new StripeOrderNotFoundError(payment.orderId)
    }
    return { payment, order, duplicate: true }
  }

  // Validates against PAYMENT_STATUS_TRANSITIONS before writing
  // anything — throws InvalidPaymentTransitionError for a sequence the
  // state machine doesn't allow (e.g. a stale/out-of-order delivery
  // reporting `payment_intent.succeeded` after we've already recorded a
  // later status for this Payment).
  assertValidPaymentTransition(payment.status, outcome.paymentStatus)

  const updatedPayment = await deps.paymentRepository.updateStatus(
    payment.id,
    outcome.paymentStatus,
    {
      providerReference: paymentIntentId,
    },
  )
  if (!updatedPayment) {
    throw new StripePaymentNotFoundError(paymentIntentId)
  }

  const order = await deps.orderRepository.getById(payment.orderId)
  if (!order) {
    throw new StripeOrderNotFoundError(payment.orderId)
  }

  let updatedOrder = order

  if (outcome.orderStatus !== order.status) {
    assertValidOrderTransition(order.status, outcome.orderStatus)
    updatedOrder = (await deps.orderRepository.updateStatus(order.id, outcome.orderStatus)) ?? order

    if (outcome.orderStatus === 'PAID') {
      // The one and only moment fulfilment side effects happen — see
      // the doc comment's idempotency note above for why this can only
      // ever run once per order, across any number of redelivered
      // webhook events.
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
