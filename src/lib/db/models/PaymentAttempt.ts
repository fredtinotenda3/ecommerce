// src/lib/db/models/PaymentAttempt.ts
//
// Brand-new collection (`payment_attempts`). Records every individual
// call out to a payment provider (and its raw request/response), even
// when it fails before a Payment status change would otherwise be
// recorded. This is what lets support/ops answer "did we actually call
// Paynow for this order, and what did it say?" without relying on
// application logs.

import { Schema, type Connection, type Document, type Types } from 'mongoose'
import type { PaymentAttemptStatus, PaymentProviderName } from '../../domain/types'
import { getOrCreateModel } from './getOrCreateModel'

export interface PaymentAttemptDocument extends Document {
  _id: Types.ObjectId
  orderId: Types.ObjectId
  paymentId?: Types.ObjectId | null
  provider: PaymentProviderName
  merchantReference: string
  status: PaymentAttemptStatus
  requestPayload?: Record<string, unknown> | null
  responsePayload?: Record<string, unknown> | null
  errorMessage?: string | null
  createdAt: Date
}

const PaymentAttemptSchema = new Schema<PaymentAttemptDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'orders', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'payments', default: null },
    provider: { type: String, required: true },
    merchantReference: { type: String, required: true },
    status: { type: String, required: true, default: 'PENDING' },
    requestPayload: { type: Schema.Types.Mixed, default: null },
    responsePayload: { type: Schema.Types.Mixed, default: null },
    errorMessage: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'payment_attempts',
  },
)

PaymentAttemptSchema.index({ orderId: 1 })
PaymentAttemptSchema.index({ merchantReference: 1 })

export const getPaymentAttemptModel = (connection: Connection) =>
  getOrCreateModel<PaymentAttemptDocument>(
    connection,
    'NativePaymentAttempt',
    PaymentAttemptSchema,
    'payment_attempts',
  )