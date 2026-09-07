// src/lib/db/models/Global.ts
//
// maps onto Payload's existing `globals` collection.
//
// The previous CMS stored ALL globals (Header,
// Footer, Settings, ...) as separate documents in a single `globals`
// collection, discriminated by a `globalType` field equal to the global's
// slug
// — `discriminatorKey: 'globalType'`, `mongoose.model('globals', ...)`).
//
// The `link` field (src/payload/fields/link.ts) declares its `reference`
// relationship as `relationTo: ['pages']` — an ARRAY, even though there is
// only one type in it — which makes Payload treat it as a polymorphic
// relation and store it as `{ relationTo: 'pages', value: ObjectId }`
// rather than a bare ObjectId (see buildSchema.js's
// `hasManyRelations = Array.isArray(field.relationTo)`). The link's `icon`
// (an `upload` field with a plain string `relationTo: 'media'`) and
// Settings' `productsPage` (a plain `relationTo: 'pages'`) are singular
// relations, so those ARE stored as bare ObjectIds.
//
// This model is intentionally read-shape-only (`strict: false`) — it does
// not attempt to own global write/validation semantics, same treatment as
// Category/Page/Media in this directory.
import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import { getOrCreateModel } from './getOrCreateModel'

export interface GlobalLinkDocument {
  type?: 'reference' | 'custom'
  newTab?: boolean
  label?: string
  url?: string
  reference?: {
    relationTo?: string
    value?: Types.ObjectId
  } | null
  icon?: Types.ObjectId | null
}

export interface GlobalNavItemDocument {
  link?: GlobalLinkDocument
  id?: string
}

export interface GlobalDocument extends Document {
  _id: Types.ObjectId
  globalType: 'header' | 'footer' | 'settings' | string
  copyright?: string
  navItems?: GlobalNavItemDocument[]
  productsPage?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const GlobalSchema = new Schema<GlobalDocument>(
  {
    globalType: { type: String },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'globals',
  },
)

export const getGlobalModel = (connection: Connection): Model<GlobalDocument> =>
  getOrCreateModel<GlobalDocument>(connection, 'NativeGlobal', GlobalSchema, 'globals')
