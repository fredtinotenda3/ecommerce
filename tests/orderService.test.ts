// tests/orderService.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { OrderService, OrderNotFoundError } from '../src/lib/services/OrderService'
import { InvalidOrderTransitionError } from '../src/lib/services/orderStateMachine'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'

describe('OrderService.createOrderFromCart', () => {
  let productRepo: FakeProductRepository
  let orderRepo: FakeOrderRepository
  let service: OrderService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    orderRepo = new FakeOrderRepository()
    service = new OrderService(orderRepo, productRepo)

    productRepo.seed(buildTestProduct({ id: 'p1', title: 'Widget', price: 1500, currency: 'USD' }))
    productRepo.seed(buildTestProduct({ id: 'p2', title: 'Gadget', price: 3000, currency: 'USD' }))
  })

  it('creates an order priced entirely from the product repository, in PENDING_PAYMENT status', async () => {
    const order = await service.createOrderFromCart('customer1', [
      { productId: 'p1', quantity: 2 },
      { productId: 'p2', quantity: 1 },
    ])

    expect(order.status).toBe('PENDING_PAYMENT')
    expect(order.currency).toBe('USD')
    expect(order.subtotal).toBe(2 * 1500 + 3000)
    expect(order.total).toBe(order.subtotal)
    expect(order.items).toHaveLength(2)
    expect(order.items[0].unitPrice).toBe(1500)
    expect(order.orderNumber).toMatch(/^ORD-/)
  })

  it('rejects an order containing a product with no price set', async () => {
    productRepo.seed(buildTestProduct({ id: 'p3', price: null, currency: null }))

    await expect(
      service.createOrderFromCart('customer1', [{ productId: 'p3', quantity: 1 }]),
    ).rejects.toThrow()
  })
})

describe('OrderService.transitionStatus', () => {
  let productRepo: FakeProductRepository
  let orderRepo: FakeOrderRepository
  let service: OrderService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    orderRepo = new FakeOrderRepository()
    service = new OrderService(orderRepo, productRepo)
    productRepo.seed(buildTestProduct({ id: 'p1', price: 1000, currency: 'USD' }))
  })

  it('applies a valid transition', async () => {
    const order = await service.createOrderFromCart('customer1', [{ productId: 'p1', quantity: 1 }])
    const updated = await service.transitionStatus(order.id, 'PAID')
    expect(updated.status).toBe('PAID')
  })

  it('rejects an invalid transition and leaves the order unchanged', async () => {
    const order = await service.createOrderFromCart('customer1', [{ productId: 'p1', quantity: 1 }])

    await expect(service.transitionStatus(order.id, 'FULFILLED')).rejects.toThrow(
      InvalidOrderTransitionError,
    )

    const stillPending = await service.getById(order.id)
    expect(stillPending?.status).toBe('PENDING_PAYMENT')
  })

  it('throws OrderNotFoundError for an unknown order id', async () => {
    await expect(service.transitionStatus('does-not-exist', 'PAID')).rejects.toThrow(
      OrderNotFoundError,
    )
  })
})
