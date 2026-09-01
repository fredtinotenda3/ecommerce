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
// checkout path this phase adds (`payment_intent.*`). Recording a
// verified event's outcome onto an Order/Payment record is NOT done
// here yet — see the Phase 13E report's "Remaining Blockers" for why
// (native Stripe checkout does not yet create an Order/Payment record
// at PaymentIntent-creation time the way the Paynow path does).

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

  return {
    eventId: event.id,
    eventType: event.type,
    handled: PAYMENT_INTENT_EVENT_TYPES.has(event.type),
  }
}
