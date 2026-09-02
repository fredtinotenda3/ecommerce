// tests/stripeOrderService.test.ts
//
// PHASE 13F-A — tests the native Stripe order-creation orchestrator.
// Uses the real OrderService/PaymentService wired to fakes (same
// approach as tests/paynowCheckoutService.test.ts), so this also
// exercises (end to end, without a database) the server-authoritative
// pricing guarantee: nothing in `CreateNativeStripeOrderInput` carries a
// price, and the resulting Order/Payment amounts always come from
// FakeProductRepository's seeded prices, never anything a test "client"
// might have claimed via `paymentIntentId`.

import { beforeEach, describe, expect, it } from 'vitest'

import { StripeProvider } from '../src/lib/payments/StripeProvider'
import { OrderService } from '../src/lib/services/OrderService'
import { PaymentService, UnsupportedCurrencyError } from '../src/lib/services/PaymentService'
import {
  createNativeStripeOrder,
  StripeOrderNotFoundForPaymentError,
} from '../src/lib/services/StripeOrderService'
import { EmptyCartError, ProductNotPurchasableError } from '../src/lib/services/pricing'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'

describe('createNativeStripeOrder', () => {
  let productRepo: FakeProductRepository
  let orderRepo: FakeOrderRepository
  let paymentRepo: FakePaymentRepository
  let orderService: OrderService
  let paymentService: PaymentService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    orderRepo = new FakeOrderRepository()
    paymentRepo = new FakePaymentRepository()
    orderService = new OrderService(orderRepo, productRepo)
    paymentService = new PaymentService(paymentRepo, new StripeProvider())

    productRepo.seed(buildTestProduct({ id: 'p1', title: 'Widget', price: 1999, currency: 'USD' }))
  })

  it('SERVER-AUTHORITATIVE PRICING: computes the Order/Payment total from the product repository, ignoring anything the caller might claim', async () => {
    const result = await createNativeStripeOrder(
      {
        customerId: 'customer1',
        // Cart items only ever carry productId + quantity — there is no
        // field here for a client-supplied price/total to even go.
        cartItems: [{ productId: 'p1', quantity: 3 }],
        paymentIntentId: 'pi_test_123',
      },
      { orderService, paymentService, paymentRepository: paymentRepo },
    )

    expect(result.order.total).toBe(1999 * 3)
    expect(result.order.currency).toBe('USD')
    expect(result.order.status).toBe('PENDING_PAYMENT')
    expect(result.payment.amount).toBe(result.order.total)
    expect(result.payment.provider).toBe('stripe')
    expect(result.payment.status).toBe('PENDING')
    expect(result.payment.providerReference).toBe('pi_test_123')
    expect(result.alreadyExisted).toBe(false)
  })

  it('creates exactly one Order and one Payment per call', async () => {
    await createNativeStripeOrder(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        paymentIntentId: 'pi_test_456',
      },
      { orderService, paymentService, paymentRepository: paymentRepo },
    )

    const orders = await orderRepo.getByCustomer('customer1')
    expect(orders).toHaveLength(1)

    const payments = await paymentRepo.getByOrderId(orders[0].id)
    expect(payments).toHaveLength(1)
  })

  it('IDEMPOTENCY: calling twice with the same paymentIntentId returns the SAME Order/Payment pair rather than creating a second Order', async () => {
    const first = await createNativeStripeOrder(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        paymentIntentId: 'pi_test_retry',
      },
      { orderService, paymentService, paymentRepository: paymentRepo },
    )

    const second = await createNativeStripeOrder(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        paymentIntentId: 'pi_test_retry',
      },
      { orderService, paymentService, paymentRepository: paymentRepo },
    )

    expect(second.order.id).toBe(first.order.id)
    expect(second.payment.id).toBe(first.payment.id)
    expect(second.alreadyExisted).toBe(true)

    const orders = await orderRepo.getByCustomer('customer1')
    expect(orders).toHaveLength(1)
  })

  it('a DIFFERENT paymentIntentId for the same customer/cart creates a second, independent Order', async () => {
    await createNativeStripeOrder(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        paymentIntentId: 'pi_test_a',
      },
      { orderService, paymentService, paymentRepository: paymentRepo },
    )

    await createNativeStripeOrder(
      {
        customerId: 'customer1',
        cartItems: [{ productId: 'p1', quantity: 1 }],
        paymentIntentId: 'pi_test_b',
      },
      { orderService, paymentService, paymentRepository: paymentRepo },
    )

    const orders = await orderRepo.getByCustomer('customer1')
    expect(orders).toHaveLength(2)
  })

  it('throws EmptyCartError for an empty cart, without creating an Order or Payment', async () => {
    await expect(
      createNativeStripeOrder(
        { customerId: 'customer1', cartItems: [], paymentIntentId: 'pi_test_empty' },
        { orderService, paymentService, paymentRepository: paymentRepo },
      ),
    ).rejects.toThrow(EmptyCartError)

    expect(await orderRepo.getByCustomer('customer1')).toHaveLength(0)
  })

  it('throws ProductNotPurchasableError for a product that no longer exists', async () => {
    await expect(
      createNativeStripeOrder(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'does-not-exist', quantity: 1 }],
          paymentIntentId: 'pi_test_missing_product',
        },
        { orderService, paymentService, paymentRepository: paymentRepo },
      ),
    ).rejects.toThrow(ProductNotPurchasableError)
  })

  it('rejects a currency stripe cannot settle, without creating a Payment for the Order it already made', async () => {
    productRepo.seed(
      buildTestProduct({
        id: 'p2',
        title: 'Bad Currency Widget',
        price: 500,
        currency: 'X', // fails the ISO 4217 shape check in StripeProvider
      }),
    )

    await expect(
      createNativeStripeOrder(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'p2', quantity: 1 }],
          paymentIntentId: 'pi_test_bad_currency',
        },
        { orderService, paymentService, paymentRepository: paymentRepo },
      ),
    ).rejects.toThrow(UnsupportedCurrencyError)
  })

  it('throws StripeOrderNotFoundForPaymentError if an existing Payment references an Order that no longer exists', async () => {
    // Seed a Payment directly (bypassing normal creation) whose orderId
    // does not correspond to any seeded Order — simulates data
    // corruption/an Order having been deleted out from under a Payment.
    await paymentRepo.create({
      orderId: 'does-not-exist',
      provider: 'stripe',
      merchantReference: 'ORD-ORPHAN-0001',
      amount: 100,
      currency: 'USD',
    })
    const orphanPayment = await paymentRepo.getByMerchantReference('ORD-ORPHAN-0001')
    await paymentRepo.updateStatus(orphanPayment!.id, 'PENDING', {
      providerReference: 'pi_test_orphan',
    })

    await expect(
      createNativeStripeOrder(
        {
          customerId: 'customer1',
          cartItems: [{ productId: 'p1', quantity: 1 }],
          paymentIntentId: 'pi_test_orphan',
        },
        { orderService, paymentService, paymentRepository: paymentRepo },
      ),
    ).rejects.toThrow(StripeOrderNotFoundForPaymentError)
  })
})
