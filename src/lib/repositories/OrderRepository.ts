// src/lib/repositories/OrderRepository.ts
import type { Connection, Types } from 'mongoose'

import { getOrderModel, type OrderDocument } from '../db/models/Order'
import type { Order, OrderItem, OrderStatus } from '../domain/types'

export interface CreateOrderInput {
  orderNumber: string
  customerId: string
  items: OrderItem[]
  subtotal: number
  total: number
  currency: string
  status: OrderStatus
}

export interface OrderRepository {
  getById(id: string): Promise<Order | null>
  getByOrderNumber(orderNumber: string): Promise<Order | null>
  getByCustomer(customerId: string): Promise<Order[]>
  create(input: CreateOrderInput): Promise<Order>
  updateStatus(id: string, status: OrderStatus): Promise<Order | null>
}

const toDomain = (doc: OrderDocument): Order => ({
  id: doc._id.toString(),
  orderNumber: doc.orderNumber ?? doc._id.toString(),
  customerId: doc.orderedBy ? (doc.orderedBy as Types.ObjectId).toString() : '',
  items: (doc.items ?? []).map(item => ({
    productId: item.product?.toString?.() ?? '',
    title: item.title ?? '',
    unitPrice: item.price ?? 0,
    currency: item.currency ?? doc.currency ?? 'USD',
    quantity: item.quantity ?? 0,
  })),
  subtotal: doc.subtotal ?? doc.total ?? 0,
  total: doc.total ?? 0,
  currency: doc.currency ?? 'USD',
  status: (doc.status as OrderStatus) ?? 'PENDING_PAYMENT',
  legacyStripePaymentIntentId: doc.stripePaymentIntentID ?? null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoOrderRepository implements OrderRepository {
  constructor(private readonly connection: Connection) {}

  async getById(id: string): Promise<Order | null> {
    const Model = getOrderModel(this.connection)
    const doc = await Model.findById(id).lean<OrderDocument>().exec()
    return doc ? toDomain(doc as unknown as OrderDocument) : null
  }

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    const Model = getOrderModel(this.connection)
    const doc = await Model.findOne({ orderNumber }).lean<OrderDocument>().exec()
    return doc ? toDomain(doc as unknown as OrderDocument) : null
  }

  async getByCustomer(customerId: string): Promise<Order[]> {
    const Model = getOrderModel(this.connection)
    const docs = await Model.find({ orderedBy: customerId })
      .sort({ createdAt: -1 })
      .lean<OrderDocument[]>()
      .exec()
    return (docs as unknown as OrderDocument[]).map(toDomain)
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const Model = getOrderModel(this.connection)
    const doc = await Model.create({
      orderNumber: input.orderNumber,
      orderedBy: input.customerId,
      items: input.items.map(item => ({
        product: item.productId,
        title: item.title,
        price: item.unitPrice,
        currency: item.currency,
        quantity: item.quantity,
      })),
      subtotal: input.subtotal,
      total: input.total,
      currency: input.currency,
      status: input.status,
    })
    return toDomain(doc.toObject() as OrderDocument)
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    const Model = getOrderModel(this.connection)
    const doc = await Model.findByIdAndUpdate(id, { $set: { status } }, { new: true })
      .lean<OrderDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as OrderDocument) : null
  }
}
