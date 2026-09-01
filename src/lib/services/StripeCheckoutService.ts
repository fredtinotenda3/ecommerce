// src/lib/services/StripeCheckoutService.ts
//
// PHASE 13E — pure orchestrator for creating a Stripe PaymentIntent from
// a customer's cart, with NO Payload dependency and NO trust in
// anything the client supplies for pricing. Mirrors the shape of
// PaynowCheckoutService.ts (Phase 8): this file has no I/O of its own —
// it takes a `CartService` (already used natively by Phase-8-era code)
// plus a small `StripePaymentIntentGateway` interface, so it's unit
// testable with fakes (see tests/stripeCheckoutService.test.ts) without
// a real Stripe account or network access. The real Stripe SDK wiring
// lives in src/app/_api/stripeCheckoutNative.ts.
//
// Deliberately DOES NOT reuse `stripe.prices.list()` the way the legacy
// `src/payload/endpoints/create-payment-intent.ts` does: the native
// `Product` domain type's own doc comment says its `price`/`currency`
// fields are "authoritative", and `legacyStripeProductId`/
// `legacyPriceJSON` are "never read by new business logic for pricing
// decisions" (src/lib/domain/types.ts). Pulling live prices from Stripe
// would both violate that and reintroduce a Stripe-catalog dependency
// this phase exists to remove. `CartService.validateCart` (Phase 3) is
// already the single place cart totals are computed server-side from
// the database — reused as-is here, not reimplemented.

import type { CartItem, CurrencyCode, MinorUnits } from '../domain/types'
import type { CartService } from './CartService'
import { computeTotal } from './pricing'

export class StripeCartUnavailableError extends Error {
  readonly unavailableProductIds: string[]

  constructor(unavailableProductIds: string[]) {
    super('One or more items in the cart are no longer available for purchase')
    this.unavailableProductIds = unavailableProductIds
    this.name = 'StripeCartUnavailableError'
  }
}

export class StripeEmptyCartError extends Error {
  constructor() {
    super('Cannot create a PaymentIntent for an empty cart')
    this.name = 'StripeEmptyCartError'
  }
}

/** Thin seam over the real Stripe SDK (see stripeCheckoutNative.ts's
 * `stripeGateway`) — lets this service be tested without a network call
 * or API key. `findOrCreateCustomer` is idempotent: pass an existing
 * Stripe customer id through unchanged rather than creating a duplicate. */
export interface StripePaymentIntentGateway {
  findOrCreateCustomer(input: {
    existingStripeCustomerId: string | null
    email: string
    name?: string | null
  }): Promise<{ id: string }>

  createPaymentIntent(input: {
    stripeCustomerId: string
    amount: MinorUnits
    currency: CurrencyCode
  }): Promise<{ id: string; clientSecret: string }>
}

export interface CreateStripePaymentIntentInput {
  customerEmail: string
  customerName?: string | null
  /** `User.legacyStripeCustomerId` (see UserRepository.ts) — read-only
   * reuse of the existing field for idempotent customer lookup. This
   * phase does not add a way to persist a NEWLY created Stripe customer
   * id back onto the User record (see the Phase 13E report's
   * "Remaining Blockers") — every request with no existing id will
   * create a fresh Stripe customer until that lands. */
  existingStripeCustomerId: string | null
  cartItems: CartItem[]
}

export interface CreateStripePaymentIntentResult {
  clientSecret: string
  paymentIntentId: string
  stripeCustomerId: string
  amount: MinorUnits
  currency: CurrencyCode
}

export const createStripePaymentIntent = async (
  input: CreateStripePaymentIntentInput,
  deps: { cartService: CartService; gateway: StripePaymentIntentGateway },
): Promise<CreateStripePaymentIntentResult> => {
  if (input.cartItems.length === 0) {
    throw new StripeEmptyCartError()
  }

  const { validItems, unavailableProductIds, subtotal } = await deps.cartService.validateCart(
    input.cartItems,
  )

  if (!subtotal || validItems.length === 0) {
    throw new StripeCartUnavailableError(unavailableProductIds)
  }

  const total = computeTotal(subtotal)

  const customer = await deps.gateway.findOrCreateCustomer({
    existingStripeCustomerId: input.existingStripeCustomerId,
    email: input.customerEmail,
    name: input.customerName ?? null,
  })

  const paymentIntent = await deps.gateway.createPaymentIntent({
    stripeCustomerId: customer.id,
    amount: total.amount,
    currency: total.currency,
  })

  return {
    clientSecret: paymentIntent.clientSecret,
    paymentIntentId: paymentIntent.id,
    stripeCustomerId: customer.id,
    amount: total.amount,
    currency: total.currency,
  }
}
