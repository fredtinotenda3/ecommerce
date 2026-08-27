// tests/fakes/FakeOrderRepository.ts
import type {
  CreateOrderInput,
  OrderListFilter,
  OrderRepository,
} from '../../src/lib/repositories/OrderRepository'
import type { Order, OrderStatus } from '../../src/lib/domain/types'

let counter = 0

export class FakeOrderRepository implements OrderRepository {
  private orders = new Map<string, Order>()

  /** Test helper — seeds an order directly (mirrors FakeCategoryRepository's
   * `seed`), for tests that need to assert against a known set of orders
   * without going through `create`. */
  seed(order: Order): void {
    this.orders.set(order.id, order)
  }

  async getById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null
  }

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    return Array.from(this.orders.values()).find(o => o.orderNumber === orderNumber) ?? null
  }

  async getByCustomer(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.customerId === customerId)
  }

  async list(filter: OrderListFilter = {}): Promise<Order[]> {
    let results = Array.from(this.orders.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )
    if (filter.status) results = results.filter(o => o.status === filter.status)
    const limit = filter.limit ?? 50
    const page = filter.page ?? 1
    return results.slice((page - 1) * limit, (page - 1) * limit + limit)
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
