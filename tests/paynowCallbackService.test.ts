// tests/paynowCallbackService.test.ts
//
// PHASE 8 — tests the Paynow callback orchestrator directly against
// fakes (FakePaymentProvider / FakeOrderRepository / FakePaymentRepository
// / FakeUserRepository), covering every behavior the brief calls out
// explicitly: hash validation, idempotent redelivery, Order+Payment
// state transitions, and cart-clearing/purchase-recording gated on the
// PAID transition only.

import { beforeEach, describe, expect, it } from 'vitest'

import type { Order } from '../src/lib/domain/types'
import { InvalidPaymentTransitionError } from '../src/lib/services/orderStateMachine'
import {
  PaynowCallbackOrderNotFoundError,
  PaynowCallbackPaymentNotFoundError,
  processPaynowCallback,
} from '../src/lib/services/PaynowCallbackService'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FakePaymentProvider } from './fakes/FakePaymentProvider'
import { buildTestUser, FakeUserRepository } from './fakes/FakeUserRepository'

describe('processPaynowCallback', () => {
  let orderRepo: FakeOrderRepository
  let paymentRepo: FakePaymentRepository
  let userRepo: FakeUserRepository
  let provider: FakePaymentProvider

  let order: Order

  beforeEach(async () => {
    orderRepo = new FakeOrderRepository()
    paymentRepo = new FakePaymentRepository()
    userRepo = new FakeUserRepository()
    provider = new FakePaymentProvider()

    order = await orderRepo.create({
      orderNumber: 'ORD-260828-AAAA1111',
      customerId: 'customer1',
      items: [{ productId: 'p1', title: 'Widget', unitPrice: 1999, currency: 'USD', quantity: 1 }],
      subtotal: 1999,
      total: 1999,
      currency: 'USD',
      status: 'PENDING_PAYMENT',
    })

    await paymentRepo.create({
      orderId: order.id,
      provider: 'paynow',
      merchantReference: order.orderNumber,
      amount: 1999,
      currency: 'USD',
    })

    userRepo.seed(buildTestUser({ id: 'customer1', cart: [{ productId: 'p1', quantity: 1 }] }))
  })

  const deps = () => ({
    provider,
    paymentRepository: paymentRepo,
    orderRepository: orderRepo,
    userRepository: userRepo,
  })

  it('HASH VALIDATION: a callback with an invalid signature is rejected and never touches Payment/Order/cart state', async () => {
    await expect(
      processPaynowCallback({ merchantReference: order.orderNumber, valid: false }, deps()),
    ).rejects.toThrow('Invalid callback signature')

    const unchangedPayment = await paymentRepo.getByMerchantReference(order.orderNumber)
    expect(unchangedPayment?.status).toBe('PENDING')

    const unchangedOrder = await orderRepo.getById(order.id)
    expect(unchangedOrder?.status).toBe('PENDING_PAYMENT')

    const user = await userRepo.getById('customer1')
    expect(user?.cart).toHaveLength(1)
  })

  it('a valid callback marks the Payment PAID and the Order PAID', async () => {
    provider.nextCallbackStatus = 'PAID'
    const result = await processPaynowCallback({ merchantReference: order.orderNumber }, deps())

    expect(result.duplicate).toBe(false)
    expect(result.payment.status).toBe('PAID')
    expect(result.order.status).toBe('PAID')
  })

  it('CART CLEARING: clears the customer cart and records the purchase only after a confirmed PAID transition', async () => {
    provider.nextCallbackStatus = 'PAID'
    await processPaynowCallback({ merchantReference: order.orderNumber }, deps())

    const user = await userRepo.getById('customer1')
    expect(user?.cart).toEqual([])
    expect(user?.purchases).toContain('p1')
  })

  it('does NOT clear the cart for a non-PAID terminal callback', async () => {
    provider.nextCallbackStatus = 'CANCELLED'
    await processPaynowCallback({ merchantReference: order.orderNumber }, deps())

    const user = await userRepo.getById('customer1')
    expect(user?.cart).toHaveLength(1)
    expect(user?.purchases).toEqual([])

    const updatedOrder = await orderRepo.getById(order.id)
    expect(updatedOrder?.status).toBe('PAYMENT_CANCELLED')
  })

  it('IDEMPOTENCY: redelivering the same PAID callback twice does not double-process — no duplicate cart-clear/purchase side effects, and the second call is flagged duplicate', async () => {
    provider.nextCallbackStatus = 'PAID'

    const first = await processPaynowCallback({ merchantReference: order.orderNumber }, deps())
    expect(first.duplicate).toBe(false)

    // Simulate the customer adding something new to their cart between
    // the two callback deliveries — a duplicate delivery must NOT wipe
    // this out a second time (that would be an unwanted side effect of
    // reprocessing, not a real fulfilment event).
    await userRepo.updateCart('customer1', [{ productId: 'p2', quantity: 5 }])

    const second = await processPaynowCallback({ merchantReference: order.orderNumber }, deps())
    expect(second.duplicate).toBe(true)
    expect(second.payment.status).toBe('PAID')
    expect(second.order.status).toBe('PAID')

    // Untouched by the duplicate delivery.
    const user = await userRepo.getById('customer1')
    expect(user?.cart).toEqual([{ productId: 'p2', quantity: 5 }])
  })

  it('IDEMPOTENCY: duplicate callback does not write to the Order or Payment repositories a second time', async () => {
    provider.nextCallbackStatus = 'PAID'
    const first = await processPaynowCallback({ merchantReference: order.orderNumber }, deps())

    const second = await processPaynowCallback({ merchantReference: order.orderNumber }, deps())

    // updatedAt should be identical — the fake repositories bump
    // `updatedAt` on every write, so an unchanged timestamp proves no
    // second write happened.
    expect(second.payment.updatedAt.getTime()).toBe(first.payment.updatedAt.getTime())
    expect(second.order.updatedAt.getTime()).toBe(first.order.updatedAt.getTime())
  })

  it('rejects an out-of-order/stale transition the state machine does not allow, without applying it', async () => {
    provider.nextCallbackStatus = 'PAID'
    await processPaynowCallback({ merchantReference: order.orderNumber }, deps())

    // A later, stale delivery reporting FAILED after we've already
    // recorded PAID — PAID -> FAILED is not a valid transition.
    provider.nextCallbackStatus = 'FAILED'
    await expect(
      processPaynowCallback({ merchantReference: order.orderNumber }, deps()),
    ).rejects.toThrow(InvalidPaymentTransitionError)

    const finalPayment = await paymentRepo.getByMerchantReference(order.orderNumber)
    expect(finalPayment?.status).toBe('PAID') // unchanged
  })

  it('throws PaynowCallbackPaymentNotFoundError for a merchant reference with no matching Payment', async () => {
    await expect(
      processPaynowCallback({ merchantReference: 'does-not-exist' }, deps()),
    ).rejects.toThrow(PaynowCallbackPaymentNotFoundError)
  })

  it('throws PaynowCallbackOrderNotFoundError if the Payment references an Order that no longer exists', async () => {
    const orphanPayment = await paymentRepo.create({
      orderId: 'missing-order',
      provider: 'paynow',
      merchantReference: 'ORD-ORPHAN',
      amount: 1000,
      currency: 'USD',
    })
    provider.nextCallbackStatus = 'PAID'

    await expect(
      processPaynowCallback({ merchantReference: orphanPayment.merchantReference }, deps()),
    ).rejects.toThrow(PaynowCallbackOrderNotFoundError)
  })
})
