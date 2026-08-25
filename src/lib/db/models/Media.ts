// src/lib/db/models/Media.ts
// Maps onto the existing `media` collection. Payload's upload field adds
// many derived fields (sizes, focalPoint, etc.) at write time — left as
// passthrough via `strict: false` since this phase only needs to read
// alt/url/dimensions for display.
import type { Model } from 'mongoose'
import { type Connection, type Document, Schema, type Types } from 'mongoose'

import { getOrCreateModel } from './getOrCreateModel'

export interface MediaDocument extends Document {
  _id: Types.ObjectId
  alt: string
  filename?: string | null
  url?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  /** Rich text caption — declared here (Phase 3) as Mixed passthrough so
   * MediaRepository can read it for MediaBlock/Hero rendering. */
  caption?: unknown
  createdAt: Date
  updatedAt: Date
}

const MediaSchema = new Schema<MediaDocument>(
  {
    alt: { type: String },
    filename: { type: String },
    url: { type: String },
    mimeType: { type: String },
    filesize: { type: Number },
    width: { type: Number },
    height: { type: Number },
    caption: { type: Schema.Types.Mixed },
  },
  {
    strict: false,
    timestamps: true,
    collection: 'media',
  },
)

export const getMediaModel = (connection: Connection): Model<MediaDocument> =>
  getOrCreateModel<MediaDocument>(connection, 'NativeMedia', MediaSchema, 'media')
