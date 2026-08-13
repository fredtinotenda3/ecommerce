// src/lib/db/models/Payment.ts
//
// Brand-new collection (`payments`) — does not exist in the current
// Payload schema, so there is no legacy-compatibility concern here. This
// is the system of record for payment lifecycle, separate from Order so
// that a single order can (in principle) have more than one payment
// attempt across its lifetime without overloading the Order document.

import { Schema, type Connection, type Document, type Types } from 'mongoose'
import type { PaymentProviderName, PaymentStatus } from '../../domain/types'
import { getOrCreateModel } from './getOrCreateModel'

export interface PaymentDocument extends Document {
  _id: Types.ObjectId
  orderId: Types.ObjectId
  provider: PaymentProviderName
  providerReference?: string | null
  merchantReference: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentMethod?: string | null
  initiatedAt: Date
  paidAt?: Date | null
  failedAt?: Date | null
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema = new Schema<PaymentDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
    provider: { type: String, required: true },
    providerReference: { type: String, default: null },
    merchantReference: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, required: true, default: 'PENDING' },
    paymentMethod: { type: String, default: null },
    initiatedAt: { type: Date, required: true, default: () => new Date() },
    paidAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'payments',
  },
)

// Idempotency: a merchant reference must map to exactly one Payment.
PaymentSchema.index({ merchantReference: 1 }, { unique: true })
PaymentSchema.index({ orderId: 1 })
PaymentSchema.index({ providerReference: 1 })

export const getPaymentModel = (connection: Connection) =>
  getOrCreateModel<PaymentDocument>(connection, 'NativePayment', PaymentSchema, 'payments')