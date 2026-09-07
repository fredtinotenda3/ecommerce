// src/app/_api/orders.ts
//
// Read-only order queries for the customer-facing order pages and the
// `/api/orders` route handlers.
//
// Every function here takes the requesting customer's id and filters by it
// at the repository level. Ownership is never checked after the fact by the
// caller, and an order belonging to someone else is reported as "not found"
// rather than "forbidden", so order ids cannot be probed for existence.

import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import type { OrderRepository } from '../../lib/repositories/OrderRepository'
import type { PaymentRepository } from '../../lib/repositories/PaymentRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import type { Order as NativeOrder } from '../../lib/domain/types'
import type { StorefrontOrderDetail, StorefrontOrderSummary } from '../_types/storefront'
import { getRepositories } from './repositories'

export interface OrderDeps {
  orderRepository: OrderRepository
  productRepository: ProductRepository
  mediaRepository: MediaRepository
  paymentRepository: PaymentRepository
}

const toSummary = (order: NativeOrder): StorefrontOrderSummary => ({
  id: order.id,
  orderNumber: order.orderNumber,
  total: order.total,
  currency: order.currency,
  status: order.status,
  createdAt: order.createdAt.toISOString(),
})

/** Orchestration only — takes repository interfaces so it can be unit
 * tested with fakes. */
export const buildCustomerOrderList = async (
  customerId: string,
  deps: Pick<OrderDeps, 'orderRepository'>,
): Promise<StorefrontOrderSummary[]> => {
  const orders = await deps.orderRepository.getByCustomer(customerId)
  return orders.map(toSummary)
}

/** Returns `null` when the order does not exist OR belongs to another
 * customer — see this file's header for why those are indistinguishable.
 *
 * Line items are rendered from the order's own frozen `unitPrice`/`title`;
 * the product is looked up only for its slug and thumbnail, which are
 * presentational. A product deleted or repriced since the order was placed
 * therefore cannot change what the order says was charged. */
export const buildCustomerOrderDetail = async (
  orderId: string,
  customerId: string,
  deps: OrderDeps,
): Promise<StorefrontOrderDetail | null> => {
  const order = await deps.orderRepository.getById(orderId)
  if (!order || order.customerId !== customerId) return null

  const items = await Promise.all(
    order.items.map(async item => {
      const product = await deps.productRepository.getById(item.productId)
      const image =
        product?.meta.imageId != null
          ? (await deps.mediaRepository.getById(product.meta.imageId))?.url ?? null
          : null

      return {
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        slug: product?.slug ?? null,
        image: image ? { url: image } : null,
      }
    }),
  )

  const payments = await deps.paymentRepository.getByOrderId(order.id)
  const payment = payments.length > 0 ? payments[payments.length - 1] : null

  return {
    ...toSummary(order),
    subtotal: order.subtotal,
    items,
    payment: payment
      ? {
          provider: payment.provider,
          status: payment.status,
          reference: payment.merchantReference,
          paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        }
      : null,
  }
}

export const fetchCustomerOrders = async (
  customerId: string,
): Promise<StorefrontOrderSummary[]> => {
  const { orders } = await getRepositories()
  return buildCustomerOrderList(customerId, { orderRepository: orders })
}

export const fetchCustomerOrder = async (
  orderId: string,
  customerId: string,
): Promise<StorefrontOrderDetail | null> => {
  const { orders, products, media, payments } = await getRepositories()
  return buildCustomerOrderDetail(orderId, customerId, {
    orderRepository: orders,
    productRepository: products,
    mediaRepository: media,
    paymentRepository: payments,
  })
}
