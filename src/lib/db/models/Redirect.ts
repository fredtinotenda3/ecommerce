// src/lib/db/models/Redirect.ts
//
// Managed redirects, stored in MongoDB so they can be edited at runtime
// rather than requiring a rebuild.
//
// `from` is uniquely indexed: two rules for the same path would make the
// applied redirect depend on document order, which is not something an
// operator can reason about.
import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import { getOrCreateModel } from './getOrCreateModel'

export interface RedirectDocument extends Document {
  _id: Types.ObjectId
  from: string
  to: string
  permanent: boolean
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

const RedirectSchema = new Schema<RedirectDocument>(
  {
    from: { type: String, required: true, unique: true },
    to: { type: String, required: true },
    permanent: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'redirects',
  },
)

export const getRedirectModel = (connection: Connection): Model<RedirectDocument> =>
  getOrCreateModel<RedirectDocument>(connection, 'NativeRedirect', RedirectSchema, 'redirects')
