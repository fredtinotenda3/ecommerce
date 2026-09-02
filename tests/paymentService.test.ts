// tests/paymentService.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { StripeProvider } from '../src/lib/payments/StripeProvider'
import { PaymentInitiationError, PaymentService, UnsupportedCurrencyError } from '../src/lib/services/PaymentService'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FailingFakePaymentProvider, FakePaymentProvider } from './fakes/FakePaymentProvider'
import type { Order } from '../src/lib/domain/types'

const buildTestOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order1',
  orderNumber: 'ORD-260816-AAAA1111',
  customerId: 'customer1',
  items: [{ productId: 'p1', title: 'Widget', unitPrice: 1000, currency: 'USD', quantity: 1 }],
  subtotal: 1000,
  total: 1000,
  currency: 'USD',
  status: 'PENDING_PAYMENT',
  legacyStripePaymentIntentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('PaymentService.initiatePaymentForOrder', () => {
  let paymentRepo: FakePaymentRepository
  let provider: FakePaymentProvider
  let service: PaymentService

  beforeEach(() => {
    paymentRepo = new FakePaymentRepository()
    provider = new FakePaymentProvider()
    service = new PaymentService(paymentRepo, provider)
  })

  it('creates a Payment and calls the provider exactly once', async () => {
    const order = buildTestOrder()
    const payment = await service.initiatePaymentForOrder(order)

    expect(payment.merchantReference).toBe(order.orderNumber)
    expect(payment.status).toBe('PENDING')
    expect(payment.providerReference).toBe(`fake-ref-${order.orderNumber}`)
    expect(provider.createPaymentCallCount).toBe(1)
  })

  it('IDEMPOTENCY: calling initiatePaymentForOrder twice for the same order does not create a second Payment or call the provider twice', async () => {
    const order = buildTestOrder()

    const first = await service.initiatePaymentForOrder(order)
    const second = await service.initiatePaymentForOrder(order)

    expect(second.id).toBe(first.id)
    expect(provider.createPaymentCallCount).toBe(1)

    const allPaymentsForOrder = await paymentRepo.getByOrderId(order.id)
    expect(allPaymentsForOrder).toHaveLength(1)
  })

  it('rejects a currency the provider does not support', async () => {
    const order = buildTestOrder({ currency: 'EUR', total: 1000 })
    await expect(service.initiatePaymentForOrder(order)).rejects.toThrow(UnsupportedCurrencyError)
  })

  it('marks the Payment FAILED and throws when the provider rejects initiation', async () => {
    const failingProvider = new FailingFakePaymentProvider()
    const failingService = new PaymentService(paymentRepo, failingProvider)
    const order = buildTestOrder()

    await expect(failingService.initiatePaymentForOrder(order)).rejects.toThrow(
      PaymentInitiationError,
    )

    const payment = await paymentRepo.getByMerchantReference(order.orderNumber)
    expect(payment?.status).toBe('FAILED')
  })
})

describe('PaymentService.handleProviderCallback', () => {
  let paymentRepo: FakePaymentRepository
  let provider: FakePaymentProvider
  let service: PaymentService

  beforeEach(() => {
    paymentRepo = new FakePaymentRepository()
    provider = new FakePaymentProvider()
    service = new PaymentService(paymentRepo, provider)
  })

  it('transitions the Payment to PAID on a valid callback', async () => {
    const order = buildTestOrder()
    await service.initiatePaymentForOrder(order)

    provider.nextCallbackStatus = 'PAID'
    const result = await service.handleProviderCallback({ merchantReference: order.orderNumber })

    expect(result.status).toBe('PAID')
    expect(result.paidAt).not.toBeNull()
  })

  it('IDEMPOTENCY: redelivering the same callback twice does not error and does not double-process', async () => {
    const order = buildTestOrder()
    await service.initiatePaymentForOrder(order)

    provider.nextCallbackStatus = 'PAID'
    const first = await service.handleProviderCallback({ merchantReference: order.orderNumber })
    const second = await service.handleProviderCallback({ merchantReference: order.orderNumber })

    expect(first.status).toBe('PAID')
    expect(second.status).toBe('PAID')
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime()) // no-op, not re-written
  })

  it('rejects a callback with an invalid signature rather than trusting it', async () => {
    const order = buildTestOrder()
    await service.initiatePaymentForOrder(order)

    await expect(
      service.handleProviderCallback({ merchantReference: order.orderNumber, valid: false }),
    ).rejects.toThrow('Invalid callback signature')

    const payment = await paymentRepo.getByMerchantReference(order.orderNumber)
    expect(payment?.status).toBe('PENDING') // unchanged
  })

  it('throws if the callback references a merchant reference with no matching Payment', async () => {
    await expect(
      service.handleProviderCallback({ merchantReference: 'does-not-exist' }),
    ).rejects.toThrow()
  })
})

describe('PaymentService.recordProviderInitiatedPayment', () => {
  // PHASE 13F-A — this method is for providers (native Stripe) whose
  // payment was already created with the provider BEFORE the Order
  // existed. Uses the real StripeProvider adapter (no I/O of its own —
  // see its file header) rather than FakePaymentProvider, since the
  // point of this method is that it NEVER calls
  // provider.createPayment()/handleCallback() — StripeProvider throws if
  // either is ever reached, which doubles as an assertion that this
  // method really doesn't call them.
  let paymentRepo: FakePaymentRepository
  let service: PaymentService

  beforeEach(() => {
    paymentRepo = new FakePaymentRepository()
    service = new PaymentService(paymentRepo, new StripeProvider())
  })

  it('creates a Payment tagged provider: "stripe", PENDING, with the given providerReference — without calling createPayment', async () => {
    const order = buildTestOrder()
    const payment = await service.recordProviderInitiatedPayment(order, {
      providerReference: 'pi_test_123',
    })

    expect(payment.provider).toBe('stripe')
    expect(payment.merchantReference).toBe(order.orderNumber)
    expect(payment.status).toBe('PENDING')
    expect(payment.providerReference).toBe('pi_test_123')
    expect(payment.amount).toBe(order.total)
    expect(payment.currency).toBe(order.currency)
  })

  it('IDEMPOTENCY: calling twice for the same order returns the existing Payment rather than creating a second one', async () => {
    const order = buildTestOrder()

    const first = await service.recordProviderInitiatedPayment(order, {
      providerReference: 'pi_test_123',
    })
    const second = await service.recordProviderInitiatedPayment(order, {
      providerReference: 'pi_test_123_retry',
    })

    expect(second.id).toBe(first.id)
    // The second call's providerReference is NOT applied — the existing
    // Payment (and its original providerReference) wins, same as
    // initiatePaymentForOrder's idempotency contract.
    expect(second.providerReference).toBe('pi_test_123')

    const allPaymentsForOrder = await paymentRepo.getByOrderId(order.id)
    expect(allPaymentsForOrder).toHaveLength(1)
  })

  it('rejects a currency Stripe cannot settle', async () => {
    const order = buildTestOrder({ currency: 'X', total: 1000 })
    await expect(
      service.recordProviderInitiatedPayment(order, { providerReference: 'pi_test_bad' }),
    ).rejects.toThrow(UnsupportedCurrencyError)
  })

  it('is findable afterwards by providerReference (what the webhook looks Payments up by)', async () => {
    const order = buildTestOrder()
    await service.recordProviderInitiatedPayment(order, { providerReference: 'pi_test_findme' })

    const found = await paymentRepo.getByProviderReference('pi_test_findme')
    expect(found?.orderId).toBe(order.id)
  })
})
