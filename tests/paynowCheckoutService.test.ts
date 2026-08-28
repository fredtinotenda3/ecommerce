// tests/paynowCheckoutService.test.ts
//
// PHASE 8 — tests the checkout-initiation orchestrator. Uses the real
// OrderService/PaymentService wired to fakes, so this also exercises
// (end to end, without a database) the server-authoritative pricing
// guarantee: nothing in `InitiatePaynowCheckoutInput` carries a price,
// and the resulting Order/Payment amounts always come from
// FakeProductRepository's seeded prices, never anything a test "client"
// might have claimed.

import { beforeEach, describe, expect, it } from 'vitest'

import { OrderService } from '../src/lib/services/OrderService'
import { PaymentService, UnsupportedCurrencyError } from '../src/lib/services/PaymentService'
import {
  CheckoutRedirectMissingError,
  initiatePaynowCheckout,
} from '../src/lib/services/PaynowCheckoutService'
import { EmptyCartError, ProductNotPurchasableError } from '../src/lib/services/pricing'
import type { Order } from '../src/lib/domain/types'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FailingFakePaymentProvider, FakePaymentProvider } from './fakes/FakePaymentProvider'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'

describe('initiatePaynowCheckout', () => {
  let productRepo: FakeProductRepository
  let orderRepo: FakeOrderRepository
  let paymentRepo: FakePaymentRepository
  let provider: FakePaymentProvider
  let orderService: OrderService
  let paymentService: PaymentService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    orderRepo = new FakeOrderRepository()
    paymentRepo = new FakePaymentRepository()
    provider = new FakePaymentProvider()
    orderService = new OrderService(orderRepo, productRepo)
    paymentService = new PaymentService(paymentRepo, provider)

    productRepo.seed(buildTestProduct({ id: 'p1', title: 'Widget', price: 1999, currency: 'USD' }))
  })

  const buildReturnUrl = (order: Order): string =>
    `https://shop.test/api/payments/paynow/return?reference=${order.orderNumber}`

  it('SERVER-AUTHORITATIVE PRICING: computes the Order/Payment total from the product repository, ignoring anything the caller might claim about price', async () => {
    const result = await initiatePaynowCheckout(
      {
        customerId: 'customer1',
        // Cart items only ever carry productId + quantity — there is no
        // field here for a client-supplied price/total to even go.
        cartItems: [{ productId: 'p1', quantity: 3 }],
        resultUrl: 'https://shop.test/api/payments/paynow/callback',
        buildReturnUrl,
      },
      { orderService, paymentService },
    )

    expect(result.order.total).toBe(1999 * 3)
    expect(result.order.currency).toBe('USD')
    expect(result.order.status).toBe('PENDING_PAYMENT')
    expect(result.payment.amount).toBe(result.order.total)
    expect(result.payment.provider).toBe('paynow')
    expect(result.payment.status).toBe('PENDING')
    expect(result.redirectUrl).toContain(result.order.orderNumber)
  })

  it('creates exactly one Order and one Payment per call, calling the provider exactly once', async () => {
    await initiatePaynowCheckout(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        resultUrl: 'https://shop.test/callback',
        buildReturnUrl,
      },
      { orderService, paymentService },
    )

    const orders = await orderRepo.getByCustomer('customer1')
    expect(orders).toHaveLength(1)
    expect(provider.createPaymentCallCount).toBe(1)
  })

  it('passes the created Order into buildReturnUrl, so the return URL can carry the real order number', async () => {
    let capturedOrder: Order | null = null

    await initiatePaynowCheckout(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        resultUrl: 'https://shop.test/callback',
        buildReturnUrl: order => {
          capturedOrder = order
          return `https://shop.test/return?reference=${order.orderNumber}`
        },
      },
      { orderService, paymentService },
    )

    expect(capturedOrder?.orderNumber).toMatch(/^ORD-/)
  })

  it('rejects an empty cart without creating an Order or calling the provider', async () => {
    await expect(
      initiatePaynowCheckout(
        { customerId: 'customer1', cartItems: [], resultUrl: 'https://shop.test/cb', buildReturnUrl },
        { orderService, paymentService },
      ),
    ).rejects.toThrow(EmptyCartError)

    expect(await orderRepo.getByCustomer('customer1')).toHaveLength(0)
    expect(provider.createPaymentCallCount).toBe(0)
  })

  it('rejects a cart item whose product has no authoritative price set, without calling the provider', async () => {
    productRepo.seed(buildTestProduct({ id: 'p2', price: null, currency: null }))

    await expect(
      initiatePaynowCheckout(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'p2', quantity: 1 }],
          resultUrl: 'https://shop.test/cb',
          buildReturnUrl,
        },
        { orderService, paymentService },
      ),
    ).rejects.toThrow(ProductNotPurchasableError)

    expect(provider.createPaymentCallCount).toBe(0)
  })

  it('rejects a currency the provider does not support, after the Order has already been priced', async () => {
    productRepo.seed(buildTestProduct({ id: 'p3', price: 500, currency: 'EUR' }))
    provider.supportedCurrencies = new Set(['USD'])

    await expect(
      initiatePaynowCheckout(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'p3', quantity: 1 }],
          resultUrl: 'https://shop.test/cb',
          buildReturnUrl,
        },
        { orderService, paymentService },
      ),
    ).rejects.toThrow(UnsupportedCurrencyError)
  })

  it('propagates a provider initiation failure rather than returning a fake redirect URL', async () => {
    const failingProvider = new FailingFakePaymentProvider()
    const failingPaymentService = new PaymentService(paymentRepo, failingProvider)

    await expect(
      initiatePaynowCheckout(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'p1', quantity: 1 }],
          resultUrl: 'https://shop.test/cb',
          buildReturnUrl,
        },
        { orderService, paymentService: failingPaymentService },
      ),
    ).rejects.toThrow()
  })

  it('throws CheckoutRedirectMissingError if the provider succeeds without ever returning a redirect URL', async () => {
    class NoRedirectProvider extends FakePaymentProvider {
      async createPayment(input: Parameters<FakePaymentProvider['createPayment']>[0]) {
        return { success: true, providerReference: `ref-${input.merchantReference}` }
      }
    }
    const noRedirectProvider = new NoRedirectProvider()
    const noRedirectPaymentService = new PaymentService(paymentRepo, noRedirectProvider)

    await expect(
      initiatePaynowCheckout(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'p1', quantity: 1 }],
          resultUrl: 'https://shop.test/cb',
          buildReturnUrl,
        },
        { orderService, paymentService: noRedirectPaymentService },
      ),
    ).rejects.toThrow(CheckoutRedirectMissingError)
  })
})
