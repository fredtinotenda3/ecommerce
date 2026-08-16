// src/lib/repositories/PaymentRepository.ts
import type { Connection, Types } from 'mongoose'

import { getPaymentModel, type PaymentDocument } from '../db/models/Payment'
import type { Payment, PaymentProviderName, PaymentStatus } from '../domain/types'

export interface CreatePaymentInput {
  orderId: string
  provider: PaymentProviderName
  merchantReference: string
  amount: number
  currency: string
}

export interface PaymentRepository {
  getById(id: string): Promise<Payment | null>
  getByOrderId(orderId: string): Promise<Payment[]>
  getByMerchantReference(merchantReference: string): Promise<Payment | null>
  create(input: CreatePaymentInput): Promise<Payment>
  updateStatus(
    id: string,
    status: PaymentStatus,
    extra?: {
      providerReference?: string
      paymentMethod?: string
      metadata?: Record<string, unknown>
    },
  ): Promise<Payment | null>
}

const toDomain = (doc: PaymentDocument): Payment => ({
  id: doc._id.toString(),
  orderId: (doc.orderId as Types.ObjectId).toString(),
  provider: doc.provider,
  providerReference: doc.providerReference ?? null,
  merchantReference: doc.merchantReference,
  amount: doc.amount,
  currency: doc.currency,
  status: doc.status,
  paymentMethod: doc.paymentMethod ?? null,
  initiatedAt: doc.initiatedAt,
  paidAt: doc.paidAt ?? null,
  failedAt: doc.failedAt ?? null,
  metadata: doc.metadata ?? {},
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoPaymentRepository implements PaymentRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getById(id: string): Promise<Payment | null> {
    const Model = getPaymentModel(this.connection)
    const doc = await Model.findById(id).lean<PaymentDocument>().exec()
    return doc ? toDomain(doc as unknown as PaymentDocument) : null
  }

  async getByOrderId(orderId: string): Promise<Payment[]> {
    const Model = getPaymentModel(this.connection)
    const docs = await Model.find({ orderId }).lean<PaymentDocument[]>().exec()
    return (docs as unknown as PaymentDocument[]).map(toDomain)
  }

  async getByMerchantReference(merchantReference: string): Promise<Payment | null> {
    const Model = getPaymentModel(this.connection)
    const doc = await Model.findOne({ merchantReference }).lean<PaymentDocument>().exec()
    return doc ? toDomain(doc as unknown as PaymentDocument) : null
  }

  /** Relies on the unique index on `merchantReference` (see
   * db/models/Payment.ts) to make duplicate-attempt creation fail loudly
   * rather than silently double-record a payment. Callers (PaymentService)
   * should catch the duplicate-key error and treat it as "attempt already
   * exists" rather than a hard failure — that's the idempotency contract. */
  async create(input: CreatePaymentInput): Promise<Payment> {
    const Model = getPaymentModel(this.connection)
    const doc = await Model.create({
      orderId: input.orderId,
      provider: input.provider,
      merchantReference: input.merchantReference,
      amount: input.amount,
      currency: input.currency,
      status: 'PENDING',
      initiatedAt: new Date(),
    })
    return toDomain(doc.toObject() as PaymentDocument)
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra?: {
      providerReference?: string
      paymentMethod?: string
      metadata?: Record<string, unknown>
    },
  ): Promise<Payment | null> {
    const Model = getPaymentModel(this.connection)
    const $set: Record<string, unknown> = { status }
    if (extra?.providerReference) $set.providerReference = extra.providerReference
    if (extra?.paymentMethod) $set.paymentMethod = extra.paymentMethod
    if (extra?.metadata) $set.metadata = extra.metadata
    if (status === 'PAID') $set.paidAt = new Date()
    if (status === 'FAILED') $set.failedAt = new Date()

    const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true })
      .lean<PaymentDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as PaymentDocument) : null
  }
}
