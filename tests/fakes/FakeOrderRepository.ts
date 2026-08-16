// tests/fakes/FakeOrderRepository.ts
import type { CreateOrderInput, OrderRepository } from '../../src/lib/repositories/OrderRepository'
import type { Order, OrderStatus } from '../../src/lib/domain/types'

let counter = 0

export class FakeOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>()

  async getById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null
  }

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    return Array.from(this.orders.values()).find(o => o.orderNumber === orderNumber) ?? null
  }

  async getByCustomer(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.customerId === customerId)
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const id = `order_${++counter}`
    const order: Order = {
      id,
      orderNumber: input.orderNumber,
      customerId: input.customerId,
      items: input.items,
      subtotal: input.subtotal,
      total: input.total,
      currency: input.currency,
      status: input.status,
      legacyStripePaymentIntentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.orders.set(id, order)
    return order
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const order = this.orders.get(id)
    if (!order) return null
    const updated = { ...order, status, updatedAt: new Date() }
    this.orders.set(id, updated)
    return updated
  }
}
