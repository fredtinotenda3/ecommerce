// src/lib/db/models/Order.ts
//
// Maps onto the EXISTING `orders` collection. Every field Payload's
// current `Orders` config already writes (`orderedBy`, `stripePaymentIntentID`,
// `total`, `items[].product/price/quantity`) is left untouched and
// readable via `strict: false` passthrough.
//
// NEW fields introduced by Phase 1C (orderNumber, status, subtotal,
// currency, item title/currency snapshot) are additive and optional, so
// every existing order document remains perfectly valid without a
// migration having run yet. The backfill/compat strategy for these is a
// later phase (see the audit's Data Migration Plan) — this phase only
// defines the shape.

import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import type { OrderStatus } from '../../domain/types'
import { getOrCreateModel } from './getOrCreateModel'

export interface OrderItemSubdocument {
  product: Types.ObjectId
  title?: string
  price?: number
  currency?: string
  quantity?: number
}

export interface OrderDocument extends Document {
  _id: Types.ObjectId
  orderedBy?: Types.ObjectId

  // --- New native order fields (Phase 1C) ---
  orderNumber?: string | null
  status?: OrderStatus | null
  subtotal?: number | null
  currency?: string | null

  // --- Existing fields (untouched) ---
  total?: number
  items?: OrderItemSubdocument[]
  stripePaymentIntentID?: string | null

  createdAt: Date
  updatedAt: Date
}

const OrderSchema = new Schema<OrderDocument>(
  {
    orderedBy: { type: Schema.Types.ObjectId, ref: 'users' },

    orderNumber: { type: String, default: null },
    status: { type: String, default: null },
    subtotal: { type: Number, default: null },
    currency: { type: String, default: null },

    total: { type: Number },
    items: [
      {
        _id: false,
        product: { type: Schema.Types.ObjectId, ref: 'products' },
        title: { type: String },
        price: { type: Number },
        currency: { type: String },
        quantity: { type: Number },
      },
    ],
    stripePaymentIntentID: { type: String },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'orders',
  },
)

// Sparse + unique: only enforced once orderNumber is actually populated,
// so existing orders (orderNumber == null) never collide with each other.
OrderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true })

export const getOrderModel = (connection: Connection): Model<OrderDocument> =>
  getOrCreateModel<OrderDocument>(connection, 'NativeOrder', OrderSchema, 'orders')
