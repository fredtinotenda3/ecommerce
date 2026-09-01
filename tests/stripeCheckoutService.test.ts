// tests/stripeCheckoutService.test.ts
//
// PHASE 13E — tests the native Stripe PaymentIntent orchestrator. Uses
// the real `CartService` wired to `FakeProductRepository` (no database),
// plus a fake `StripePaymentIntentGateway` (no Stripe network/API key).
// Mirrors tests/paynowCheckoutService.test.ts's approach: the amount
// sent to the gateway is asserted to come from the product repository,
// never from anything the caller could claim.

import { beforeEach, describe, expect, it } from 'vitest'

import { CartService } from '../src/lib/services/CartService'
import {
  createStripePaymentIntent,
  StripeCartUnavailableError,
  StripeEmptyCartError,
  type StripePaymentIntentGateway,
} from '../src/lib/services/StripeCheckoutService'
import { buildTestProduct, FakeProductRepository } from './fakes/FakeProductRepository'

class FakeStripeGateway implements StripePaymentIntentGateway {
  createCustomerCalls: Array<{ existingStripeCustomerId: string | null; email: string }> = []
  createPaymentIntentCalls: Array<{ stripeCustomerId: string; amount: number; currency: string }> =
    []

  async findOrCreateCustomer(input: {
    existingStripeCustomerId: string | null
    email: string
    name?: string | null
  }): Promise<{ id: string }> {
    this.createCustomerCalls.push({
      existingStripeCustomerId: input.existingStripeCustomerId,
      email: input.email,
    })
    return { id: input.existingStripeCustomerId ?? 'cus_new_123' }
  }

  async createPaymentIntent(input: {
    stripeCustomerId: string
    amount: number
    currency: string
  }): Promise<{ id: string; clientSecret: string }> {
    this.createPaymentIntentCalls.push(input)
    return { id: 'pi_test_123', clientSecret: 'pi_test_123_secret_abc' }
  }
}

describe('createStripePaymentIntent', () => {
  let productRepo: FakeProductRepository
  let cartService: CartService
  let gateway: FakeStripeGateway

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    cartService = new CartService(productRepo)
    gateway = new FakeStripeGateway()

    productRepo.seed(buildTestProduct({ id: 'p1', title: 'Widget', price: 1999, currency: 'USD' }))
  })

  it('SERVER-AUTHORITATIVE PRICING: computes the PaymentIntent amount from the product repository', async () => {
    const result = await createStripePaymentIntent(
      {
        customerEmail: 'jane@example.com',
        existingStripeCustomerId: null,
        cartItems: [{ productId: 'p1', quantity: 3 }],
      },
      { cartService, gateway },
    )

    expect(result.amount).toBe(1999 * 3)
    expect(result.currency).toBe('USD')
    expect(gateway.createPaymentIntentCalls[0].amount).toBe(1999 * 3)
  })

  it('throws StripeEmptyCartError for an empty cart, without calling the gateway', async () => {
    await expect(
      createStripePaymentIntent(
        { customerEmail: 'jane@example.com', existingStripeCustomerId: null, cartItems: [] },
        { cartService, gateway },
      ),
    ).rejects.toThrow(StripeEmptyCartError)

    expect(gateway.createCustomerCalls).toHaveLength(0)
    expect(gateway.createPaymentIntentCalls).toHaveLength(0)
  })

  it('throws StripeCartUnavailableError when every cart item is unpurchasable', async () => {
    await expect(
      createStripePaymentIntent(
        {
          customerEmail: 'jane@example.com',
          existingStripeCustomerId: null,
          cartItems: [{ productId: 'does-not-exist', quantity: 1 }],
        },
        { cartService, gateway },
      ),
    ).rejects.toThrow(StripeCartUnavailableError)
  })

  it('reuses an existing Stripe customer id instead of creating a new one', async () => {
    await createStripePaymentIntent(
      {
        customerEmail: 'jane@example.com',
        existingStripeCustomerId: 'cus_existing_1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
      },
      { cartService, gateway },
    )

    expect(gateway.createCustomerCalls[0].existingStripeCustomerId).toBe('cus_existing_1')
    expect(gateway.createPaymentIntentCalls[0].stripeCustomerId).toBe('cus_existing_1')
  })

  it('creates a new Stripe customer when none exists yet', async () => {
    const result = await createStripePaymentIntent(
      {
        customerEmail: 'new-customer@example.com',
        existingStripeCustomerId: null,
        cartItems: [{ productId: 'p1', quantity: 1 }],
      },
      { cartService, gateway },
    )

    expect(result.stripeCustomerId).toBe('cus_new_123')
  })

  it('returns the clientSecret and paymentIntentId from the gateway unchanged', async () => {
    const result = await createStripePaymentIntent(
      {
        customerEmail: 'jane@example.com',
        existingStripeCustomerId: null,
        cartItems: [{ productId: 'p1', quantity: 1 }],
      },
      { cartService, gateway },
    )

    expect(result.clientSecret).toBe('pi_test_123_secret_abc')
    expect(result.paymentIntentId).toBe('pi_test_123')
  })

  it('never includes an unpublished product in the charged amount', async () => {
    productRepo.seed(
      buildTestProduct({ id: 'p2', title: 'Draft Widget', price: 5000, status: 'draft' }),
    )

    const result = await createStripePaymentIntent(
      {
        customerEmail: 'jane@example.com',
        existingStripeCustomerId: null,
        cartItems: [
          { productId: 'p1', quantity: 1 },
          { productId: 'p2', quantity: 1 },
        ],
      },
      { cartService, gateway },
    )

    // Only p1 (1999) is purchasable — p2 is draft and must not contribute.
    expect(result.amount).toBe(1999)
  })
})
