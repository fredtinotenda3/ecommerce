// src/lib/services/OrderService.ts
import type { CartItem, Order, OrderStatus } from '../domain/types'
import type { OrderRepository } from '../repositories/OrderRepository'
import type { ProductRepository } from '../repositories/ProductRepository'
import { assertValidOrderTransition } from './orderStateMachine'
import {
  computeSubtotal,
  computeTotal,
  generateOrderNumber,
  productsToMap,
  resolveOrderItems,
} from './pricing'

export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order not found: ${orderId}`)
    this.name = 'OrderNotFoundError'
  }
}

export class OrderService {
  private readonly orderRepository: OrderRepository
  private readonly productRepository: ProductRepository

  constructor(orderRepository: OrderRepository, productRepository: ProductRepository) {
    this.orderRepository = orderRepository
    this.productRepository = productRepository
  }

  /** Creates a new order from a customer's cart. This is the ONLY code
   * path in the native architecture allowed to construct order line
   * items and totals — it always re-fetches products fresh from the
   * repository and prices every item from that, ignoring anything the
   * caller may have supplied about price. See pricing.ts for the
   * enforcement of that rule and the audit's Order Domain findings for
   * why this matters. */
  async createOrderFromCart(customerId: string, cartItems: CartItem[]): Promise<Order> {
    const products = await Promise.all(
      cartItems.map(item => this.productRepository.getById(item.productId)),
    )
    const productsById = productsToMap(
      products.filter((p): p is NonNullable<typeof p> => p !== null),
    )

    const items = resolveOrderItems(cartItems, productsById)
    const currency = items[0].currency
    const subtotal = computeSubtotal(items, currency)
    const total = computeTotal(subtotal)

    const orderNumber = generateOrderNumber()

    return this.orderRepository.create({
      orderNumber,
      customerId,
      items,
      subtotal: subtotal.amount,
      total: total.amount,
      currency,
      status: 'PENDING_PAYMENT',
    })
  }

  async getById(orderId: string): Promise<Order | null> {
    return this.orderRepository.getById(orderId)
  }

  async getByCustomer(customerId: string): Promise<Order[]> {
    return this.orderRepository.getByCustomer(customerId)
  }

  /** Validates the transition against the order state machine BEFORE
   * writing anything. Throws InvalidOrderTransitionError rather than
   * silently clamping/ignoring an illegal transition. */
  async transitionStatus(orderId: string, nextStatus: OrderStatus): Promise<Order> {
    const order = await this.orderRepository.getById(orderId)
    if (!order) {
      throw new OrderNotFoundError(orderId)
    }

    assertValidOrderTransition(order.status, nextStatus)

    const updated = await this.orderRepository.updateStatus(orderId, nextStatus)
    if (!updated) {
      throw new OrderNotFoundError(orderId)
    }
    return updated
  }
}
