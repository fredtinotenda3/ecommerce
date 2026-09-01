// src/app/_api/stripeCheckoutNative.ts
//
// PHASE 13E — DB/Stripe-SDK-wired entry points for
// StripeCheckoutService / StripeWebhookService. Mirrors the
// paynowCheckout.ts split (Phase 8): the lib/services files take
// repository/gateway INTERFACES for unit testing (see
// tests/stripeCheckoutService.test.ts, tests/stripeWebhookService.test.ts),
// and this file supplies the concrete Mongo repositories + the real
// `stripe` SDK client for the Phase 13E route handlers to call.
//
// This is the ONLY file this phase adds that reads/writes the real
// database or talks to the real Stripe API — every other new file is
// either a pure orchestrator (testable with fakes) or a thin route
// handler that delegates here. No Payload import anywhere in this file.

import Stripe from 'stripe'

import { getDbConnection } from '../../lib/db/connection'
import type { CartItem } from '../../lib/domain/types'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'
import { MongoUserRepository } from '../../lib/repositories/UserRepository'
import { CartService } from '../../lib/services/CartService'
import {
  createStripePaymentIntent,
  type CreateStripePaymentIntentResult,
  type StripePaymentIntentGateway,
} from '../../lib/services/StripeCheckoutService'
import {
  processStripeWebhookEvent,
  type StripeEventLike,
  type StripeWebhookHandlingResult,
  type StripeWebhookVerifier,
} from '../../lib/services/StripeWebhookService'

// Stripe's own client holds no request-scoped state (the secret key is
// read once at construction) — safe to build once and reuse across
// requests/module reloads, same rationale as caching the Paynow
// provider in paynowCheckout.ts and the DB connection in connection.ts.
let cachedStripeClient: Stripe | null = null
const getStripeClient = (): Stripe => {
  if (!cachedStripeClient) {
    cachedStripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2022-08-01',
    })
  }
  return cachedStripeClient
}

const stripeGateway: StripePaymentIntentGateway = {
  async findOrCreateCustomer({ existingStripeCustomerId, email, name }) {
    if (existingStripeCustomerId) {
      // Idempotent by design — trust the caller's existing id rather
      // than re-verifying it against Stripe on every checkout, same as
      // the legacy Payload endpoint did with `fullUser.stripeCustomerID`.
      return { id: existingStripeCustomerId }
    }
    const stripe = getStripeClient()
    const customer = await stripe.customers.create({
      email,
      name: name ?? undefined,
    })
    return { id: customer.id }
  },

  async createPaymentIntent({ stripeCustomerId, amount, currency }) {
    const stripe = getStripeClient()
    const paymentIntent = await stripe.paymentIntents.create({
      customer: stripeCustomerId,
      amount,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
    })
    return {
      id: paymentIntent.id,
      // `client_secret` is only absent on a PaymentIntent created with
      // `confirm: true` (this call doesn't set that) — the non-null
      // assertion mirrors the legacy endpoint's identical assumption
      // (`res.send({ client_secret: paymentIntent.client_secret })`).
      clientSecret: paymentIntent.client_secret as string,
    }
  },
}

const stripeWebhookVerifier: StripeWebhookVerifier = {
  constructEvent(rawBody, signature, secret): StripeEventLike {
    // `webhooks.constructEvent` is an instance method (it needs no API
    // key to verify a signature, but the SDK only exposes it via a
    // constructed client) — reuses the same cached client as
    // `stripeGateway` above, not a second Stripe instance.
    const stripe = getStripeClient()
    return stripe.webhooks.constructEvent(rawBody, signature, secret) as unknown as StripeEventLike
  },
}

/** Reads the given customer's cart fresh from the database (native
 * `users.cart.items`, the same underlying collection Payload's own cart
 * UI writes — see paynowCheckout.ts's `getCustomerCartItemsNative` for
 * the identical precedent) and creates a Stripe PaymentIntent for it.
 * Never trusts anything from the caller about price/total. */
export const createStripePaymentIntentNative = async (input: {
  customerId: string
  customerEmail: string
  customerName?: string | null
}): Promise<CreateStripePaymentIntentResult> => {
  const connection = await getDbConnection()
  const userRepository = new MongoUserRepository(connection)
  const productRepository = new MongoProductRepository(connection)
  const cartService = new CartService(productRepository)

  const user = await userRepository.getById(input.customerId)
  const cartItems: CartItem[] = user?.cart ?? []

  return createStripePaymentIntent(
    {
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      existingStripeCustomerId: user?.legacyStripeCustomerId ?? null,
      cartItems,
    },
    { cartService, gateway: stripeGateway },
  )
}

/** Verifies and classifies an inbound Stripe webhook request body. See
 * StripeWebhookService.ts's file header for what "classifies" does and
 * does not do in this phase. */
export const processStripeWebhookEventNative = (
  rawBody: string,
  signature: string | null,
): StripeWebhookHandlingResult =>
  processStripeWebhookEvent(rawBody, signature, {
    verifier: stripeWebhookVerifier,
    webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET,
  })
