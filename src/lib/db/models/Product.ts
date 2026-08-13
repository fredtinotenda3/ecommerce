// src/lib/db/models/Product.ts
//
// Maps onto the EXISTING `products` collection (same collection Payload's
// `Products` config writes to — see src/payload/collections/Products/index.ts
// and node_modules/@payloadcms/db-mongodb/dist/init.js, which registers
// Payload's own model as `mongoose.model(collection.slug, schema, collection.slug)`,
// i.e. collection name === slug, no pluralization).
//
// This schema is intentionally `strict: false`: Payload documents contain
// many fields this native layer does not yet need to understand in detail
// (e.g. the full `layout` block tree, `paywall` blocks, versioning
// metadata). `strict: false` lets Mongoose read and pass through fields
// not declared here without validating or stripping them, so this model
// is safe to use for the additive fields (price/currency/etc.) without
// requiring a full re-implementation of the block schema in this phase.
//
// NEW fields added by this phase (price, currency, compareAtPrice,
// legacyStripeProductId) are optional/nullable so that documents written
// before the backfill migration runs remain perfectly valid.

import { Schema, type Connection, type Document, type Types } from 'mongoose'
import { getOrCreateModel } from './getOrCreateModel'

export interface ProductDocument extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  _status?: 'draft' | 'published'

  // --- Native authoritative pricing (Phase 1B) ---
  price?: number | null
  currency?: string | null
  compareAtPrice?: number | null

  // --- Legacy Stripe fields (untouched, read-only from this layer) ---
  stripeProductID?: string | null
  priceJSON?: string | null

  categories?: Types.ObjectId[]
  relatedProducts?: Types.ObjectId[]
  enablePaywall?: boolean

  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<ProductDocument>(
  {
    title: { type: String },
    slug: { type: String },
    _status: { type: String },

    price: { type: Number, default: null },
    currency: { type: String, default: null },
    compareAtPrice: { type: Number, default: null },

    stripeProductID: { type: String },
    priceJSON: { type: String },

    categories: [{ type: Schema.Types.ObjectId, ref: 'categories' }],
    relatedProducts: [{ type: Schema.Types.ObjectId, ref: 'products' }],
    enablePaywall: { type: Boolean },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'products',
  },
)

ProductSchema.index({ slug: 1 })

export const getProductModel = (connection: Connection) =>
  getOrCreateModel<ProductDocument>(connection, 'NativeProduct', ProductSchema, 'products')