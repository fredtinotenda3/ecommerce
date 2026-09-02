// tests/stripeWebhookService.test.ts
//
// PHASE 13E — tests the native Stripe webhook signature verification +
// event classification. Uses a fake `StripeWebhookVerifier` (no real
// Stripe network call, no real signed payload needed).

import { beforeEach, describe, expect, it } from 'vitest'

import type { Order } from '../src/lib/domain/types'
import {
  processStripeWebhookEvent,
  reconcileStripePaymentIntentEvent,
  StripeOrderNotFoundError,
  StripePaymentNotFoundError,
  StripeWebhookConfigError,
  StripeWebhookSignatureError,
  type StripeEventLike,
  type StripeWebhookVerifier,
} from '../src/lib/services/StripeWebhookService'
import { InvalidPaymentTransitionError } from '../src/lib/services/orderStateMachine'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FakeUserRepository, buildTestUser } from './fakes/FakeUserRepository'

const buildEvent = (overrides: Partial<StripeEventLike> = {}): StripeEventLike => ({
  id: 'evt_test_1',
  type: 'payment_intent.succeeded',
  data: { object: { id: 'pi_test_123' } },
  ...overrides,
})

class FakeVerifier implements StripeWebhookVerifier {
  constructor(
    private readonly result: StripeEventLike | (() => StripeEventLike),
    private readonly shouldThrow = false,
  ) {}

  constructEvent(): StripeEventLike {
    if (this.shouldThrow) {
      throw new Error('No signatures found matching the expected signature for payload')
    }
    return typeof this.result === 'function' ? this.result() : this.result
  }
}

describe('processStripeWebhookEvent', () => {
  it('returns handled: true for a verified payment_intent.succeeded event', () => {
    const verifier = new FakeVerifier(buildEvent({ type: 'payment_intent.succeeded' }))

    const result = processStripeWebhookEvent('raw-body', 'sig_abc', {
      verifier,
      webhookSecret: 'whsec_test',
    })

    expect(result).toEqual({
      eventId: 'evt_test_1',
      eventType: 'payment_intent.succeeded',
      handled: true,
      paymentIntentId: 'pi_test_123',
    })
  })

  it('returns handled: true for payment_intent.payment_failed and payment_intent.canceled', () => {
    const verifier1 = new FakeVerifier(buildEvent({ type: 'payment_intent.payment_failed' }))
    expect(
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier: verifier1, webhookSecret: 'whsec_test' })
        .handled,
    ).toBe(true)

    const verifier2 = new FakeVerifier(buildEvent({ type: 'payment_intent.canceled' }))
    expect(
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier: verifier2, webhookSecret: 'whsec_test' })
        .handled,
    ).toBe(true)
  })

  it('returns handled: false (not an error) for an event type this phase does not act on, e.g. product.updated', () => {
    const verifier = new FakeVerifier(buildEvent({ type: 'product.updated', id: 'evt_test_2' }))

    const result = processStripeWebhookEvent('raw-body', 'sig_abc', {
      verifier,
      webhookSecret: 'whsec_test',
    })

    expect(result).toEqual({ eventId: 'evt_test_2', eventType: 'product.updated', handled: false })
  })

  it('throws StripeWebhookConfigError when no webhook secret is configured', () => {
    const verifier = new FakeVerifier(buildEvent())

    expect(() =>
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier, webhookSecret: undefined }),
    ).toThrow(StripeWebhookConfigError)
  })

  it('throws StripeWebhookSignatureError when the Stripe-Signature header is missing', () => {
    const verifier = new FakeVerifier(buildEvent())

    expect(() =>
      processStripeWebhookEvent('raw-body', null, { verifier, webhookSecret: 'whsec_test' }),
    ).toThrow(StripeWebhookSignatureError)
  })

  it('throws StripeWebhookSignatureError when the verifier rejects the signature', () => {
    const verifier = new FakeVerifier(buildEvent(), true)

    expect(() =>
      processStripeWebhookEvent('raw-body', 'sig_bad', { verifier, webhookSecret: 'whsec_test' }),
    ).toThrow(StripeWebhookSignatureError)
  })

  it('never calls the verifier when the secret is missing (fails closed before touching the payload)', () => {
    let called = false
    const verifier: StripeWebhookVerifier = {
      constructEvent() {
        called = true
        return buildEvent()
      },
    }

    expect(() =>
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier, webhookSecret: undefined }),
    ).toThrow(StripeWebhookConfigError)
    expect(called).toBe(false)
  })

  it('does not extract paymentIntentId for an unhandled event type, even if data.object.id is present', () => {
    const verifier = new FakeVerifier(buildEvent({ type: 'product.updated' }))
    const result = processStripeWebhookEvent('raw-body', 'sig_abc', {
      verifier,
      webhookSecret: 'whsec_test',
    })
    expect(result.paymentIntentId).toBeUndefined()
  })
})

// PHASE 13F-A — reconciliation against native Order/Payment records.
// Mirrors tests/paynowCallbackService.test.ts's structure.
describe('reconcileStripePaymentIntentEvent', () => {
  let paymentRepo: FakePaymentRepository
  let orderRepo: FakeOrderRepository
  let userRepo: FakeUserRepository

  const buildTestOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'order1',
    orderNumber: 'ORD-260816-AAAA1111',
    customerId: 'customer1',
    items: [{ productId: 'p1', title: 'Widget', unitPrice: 1999, currency: 'USD', quantity: 1 }],
    subtotal: 1999,
    total: 1999,
    currency: 'USD',
    status: 'PENDING_PAYMENT',
    legacyStripePaymentIntentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const seedOrderAndPayment = async (
    orderOverrides: Partial<Order> = {},
  ): Promise<{ order: Order; paymentId: string }> => {
    const order = buildTestOrder(orderOverrides)
    orderRepo.seed(order)
    const payment = await paymentRepo.create({
      orderId: order.id,
      provider: 'stripe',
      merchantReference: order.orderNumber,
      amount: order.total,
      currency: order.currency,
    })
    await paymentRepo.updateStatus(payment.id, 'PENDING', { providerReference: 'pi_test_123' })
    return { order, paymentId: payment.id }
  }

  beforeEach(() => {
    paymentRepo = new FakePaymentRepository()
    orderRepo = new FakeOrderRepository()
    userRepo = new FakeUserRepository()
    userRepo.seed(buildTestUser({ id: 'customer1', cart: [{ productId: 'p1', quantity: 1 }] }))
  })

  it('on payment_intent.succeeded: transitions Payment to PAID, Order to PAID, and clears the cart', async () => {
    await seedOrderAndPayment()

    const result = await reconcileStripePaymentIntentEvent(
      'payment_intent.succeeded',
      'pi_test_123',
      { paymentRepository: paymentRepo, orderRepository: orderRepo, userRepository: userRepo },
    )

    expect(result?.duplicate).toBe(false)
    expect(result?.payment.status).toBe('PAID')
    expect(result?.payment.paidAt).not.toBeNull()
    expect(result?.order.status).toBe('PAID')

    const user = await userRepo.getById('customer1')
    expect(user?.cart).toEqual([])
    expect(user?.purchases).toContain('p1')
  })

  it('on payment_intent.payment_failed: transitions Payment to FAILED and Order to PAYMENT_FAILED, without touching the cart', async () => {
    await seedOrderAndPayment()

    const result = await reconcileStripePaymentIntentEvent(
      'payment_intent.payment_failed',
      'pi_test_123',
      { paymentRepository: paymentRepo, orderRepository: orderRepo, userRepository: userRepo },
    )

    expect(result?.payment.status).toBe('FAILED')
    expect(result?.order.status).toBe('PAYMENT_FAILED')

    const user = await userRepo.getById('customer1')
    expect(user?.cart).toEqual([{ productId: 'p1', quantity: 1 }])
  })

  it('on payment_intent.canceled: transitions Payment to CANCELLED and Order to PAYMENT_CANCELLED', async () => {
    await seedOrderAndPayment()

    const result = await reconcileStripePaymentIntentEvent('payment_intent.canceled', 'pi_test_123', {
      paymentRepository: paymentRepo,
      orderRepository: orderRepo,
      userRepository: userRepo,
    })

    expect(result?.payment.status).toBe('CANCELLED')
    expect(result?.order.status).toBe('PAYMENT_CANCELLED')
  })

  it('IDEMPOTENCY: redelivering payment_intent.succeeded twice does not double-clear the cart or double-record purchases', async () => {
    await seedOrderAndPayment()

    const first = await reconcileStripePaymentIntentEvent('payment_intent.succeeded', 'pi_test_123', {
      paymentRepository: paymentRepo,
      orderRepository: orderRepo,
      userRepository: userRepo,
    })
    // Simulate the customer adding something new to their cart between
    // deliveries — a redelivered event must NOT wipe it out again.
    await userRepo.updateCart('customer1', [{ productId: 'p2', quantity: 1 }])

    const second = await reconcileStripePaymentIntentEvent('payment_intent.succeeded', 'pi_test_123', {
      paymentRepository: paymentRepo,
      orderRepository: orderRepo,
      userRepository: userRepo,
    })

    expect(first?.duplicate).toBe(false)
    expect(second?.duplicate).toBe(true)
    expect(second?.payment.id).toBe(first?.payment.id)

    const user = await userRepo.getById('customer1')
    expect(user?.cart).toEqual([{ productId: 'p2', quantity: 1 }])
    expect(user?.purchases).toEqual(['p1']) // not duplicated
  })

  it('returns null (not an error) for an event type this phase does not reconcile', async () => {
    await seedOrderAndPayment()

    const result = await reconcileStripePaymentIntentEvent('payment_intent.created', 'pi_test_123', {
      paymentRepository: paymentRepo,
      orderRepository: orderRepo,
      userRepository: userRepo,
    })

    expect(result).toBeNull()
  })

  it('throws StripePaymentNotFoundError when no Payment matches the PaymentIntent id', async () => {
    await expect(
      reconcileStripePaymentIntentEvent('payment_intent.succeeded', 'pi_does_not_exist', {
        paymentRepository: paymentRepo,
        orderRepository: orderRepo,
        userRepository: userRepo,
      }),
    ).rejects.toThrow(StripePaymentNotFoundError)
  })

  it('throws StripeOrderNotFoundError if the Payment references an Order that no longer exists', async () => {
    const payment = await paymentRepo.create({
      orderId: 'missing-order',
      provider: 'stripe',
      merchantReference: 'ORD-ORPHAN-0002',
      amount: 100,
      currency: 'USD',
    })
    await paymentRepo.updateStatus(payment.id, 'PENDING', { providerReference: 'pi_orphan' })

    await expect(
      reconcileStripePaymentIntentEvent('payment_intent.succeeded', 'pi_orphan', {
        paymentRepository: paymentRepo,
        orderRepository: orderRepo,
        userRepository: userRepo,
      }),
    ).rejects.toThrow(StripeOrderNotFoundError)
  })

  it('throws InvalidPaymentTransitionError for an out-of-order/stale delivery (e.g. succeeded after already refunded)', async () => {
    const { paymentId } = await seedOrderAndPayment()
    await paymentRepo.updateStatus(paymentId, 'PAID', { providerReference: 'pi_test_123' })
    await paymentRepo.updateStatus(paymentId, 'REFUNDED', { providerReference: 'pi_test_123' })

    await expect(
      reconcileStripePaymentIntentEvent('payment_intent.succeeded', 'pi_test_123', {
        paymentRepository: paymentRepo,
        orderRepository: orderRepo,
        userRepository: userRepo,
      }),
    ).rejects.toThrow(InvalidPaymentTransitionError)
  })
})
