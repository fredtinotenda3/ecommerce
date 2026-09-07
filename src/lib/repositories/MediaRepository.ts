// src/lib/repositories/MediaRepository.ts
import type { Connection } from 'mongoose'

import { getMediaModel, type MediaDocument } from '../db/models/Media'
import type { Media } from '../domain/types'

export interface MediaCreateInput {
  alt: string
  filename: string
  url: string
  mimeType: string | null
  filesize: number | null
  width?: number | null
  height?: number | null
  caption?: unknown
}

export interface MediaRepository {
  getById(id: string): Promise<Media | null>
  getByFilename(filename: string): Promise<Media | null>
  list(limit?: number): Promise<Media[]>
  count(): Promise<number>
  create(input: MediaCreateInput): Promise<Media>
  /** Only the editorial fields. The stored file itself is immutable:
   * replacing an image means uploading a new one, so that nothing already
   * referencing this record silently changes underneath it. */
  update(id: string, patch: Partial<{ alt: string; caption: unknown }>): Promise<Media | null>
  delete(id: string): Promise<boolean>
}

const toDomain = (doc: MediaDocument): Media => ({
  id: doc._id.toString(),
  alt: doc.alt,
  url: doc.url ?? null,
  filename: doc.filename ?? null,
  mimeType: doc.mimeType ?? null,
  filesize: doc.filesize ?? null,
  width: doc.width ?? null,
  height: doc.height ?? null,
  caption: doc.caption ?? null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoMediaRepository implements MediaRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getById(id: string): Promise<Media | null> {
    const Model = getMediaModel(this.connection)
    const doc = await Model.findById(id).lean<MediaDocument>().exec()
    return doc ? toDomain(doc as unknown as MediaDocument) : null
  }

  async getByFilename(filename: string): Promise<Media | null> {
    const Model = getMediaModel(this.connection)
    const doc = await Model.findOne({ filename }).lean<MediaDocument>().exec()
    return doc ? toDomain(doc as unknown as MediaDocument) : null
  }

  async list(limit = 50): Promise<Media[]> {
    const Model = getMediaModel(this.connection)
    const docs = await Model.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<MediaDocument[]>()
      .exec()
    return (docs as unknown as MediaDocument[]).map(toDomain)
  }

  async count(): Promise<number> {
    const Model = getMediaModel(this.connection)
    return Model.countDocuments({}).exec()
  }

  async create(input: MediaCreateInput): Promise<Media> {
    const Model = getMediaModel(this.connection)
    const doc = await Model.create({
      alt: input.alt,
      filename: input.filename,
      url: input.url,
      mimeType: input.mimeType,
      filesize: input.filesize,
      width: input.width ?? null,
      height: input.height ?? null,
      caption: input.caption ?? null,
    })
    return toDomain(doc.toObject() as MediaDocument)
  }

  async update(
    id: string,
    patch: Partial<{ alt: string; caption: unknown }>,
  ): Promise<Media | null> {
    const Model = getMediaModel(this.connection)
    const $set: Record<string, unknown> = {}
    if (typeof patch.alt === 'string') $set.alt = patch.alt
    if ('caption' in patch) $set.caption = patch.caption ?? null

    if (Object.keys($set).length === 0) return this.getById(id)

    const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true })
      .lean<MediaDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as MediaDocument) : null
  }

  async delete(id: string): Promise<boolean> {
    const Model = getMediaModel(this.connection)
    const res = await Model.findByIdAndDelete(id).exec()
    return Boolean(res)
  }
}
