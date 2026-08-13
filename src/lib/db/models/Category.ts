// src/lib/db/models/Category.ts
// Maps onto the existing `categories` collection.
import { Schema, type Connection, type Document, type Types } from 'mongoose'
import { getOrCreateModel } from './getOrCreateModel'

export interface CategoryDocument extends Document {
  _id: Types.ObjectId
  title: string
  media?: Types.ObjectId | null
  /** Added by @payloadcms/plugin-nested-docs at the Payload layer today;
   * declared here as optional/passthrough so this model can read it
   * without owning the nested-docs breadcrumb-building logic yet. */
  parent?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

const CategorySchema = new Schema<CategoryDocument>(
  {
    title: { type: String },
    media: { type: Schema.Types.ObjectId, ref: 'media' },
    parent: { type: Schema.Types.ObjectId, ref: 'categories' },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'categories',
  },
)

export const getCategoryModel = (connection: Connection) =>
  getOrCreateModel<CategoryDocument>(connection, 'NativeCategory', CategorySchema, 'categories')