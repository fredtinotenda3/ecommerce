// src/lib/db/models/Page.ts
// Maps onto the existing `pages` collection. `layout`/`hero`/`meta` are
// left as Mixed/passthrough — block and SEO schema ownership stays with
// the CMS/render layer for this phase; only structural fields needed for
// listing/lookup are declared explicitly.
import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import { getOrCreateModel } from './getOrCreateModel'

export interface PageDocument extends Document {
  _id: Types.ObjectId
  title: string
  slug: string
  _status?: 'draft' | 'published'
  layout?: unknown[]
  hero?: unknown
  meta?: {
    title?: string
    description?: string
    image?: Types.ObjectId | null
  }
  createdAt: Date
  updatedAt: Date
}

const PageSchema = new Schema<PageDocument>(
  {
    title: { type: String },
    slug: { type: String },
    _status: { type: String },
    layout: { type: Schema.Types.Mixed },
    hero: { type: Schema.Types.Mixed },
    meta: { type: Schema.Types.Mixed },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'pages',
  },
)

PageSchema.index({ slug: 1 })

export const getPageModel = (connection: Connection): Model<PageDocument> =>
  getOrCreateModel<PageDocument>(connection, 'NativePage', PageSchema, 'pages')
