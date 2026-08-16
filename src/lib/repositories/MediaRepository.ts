// src/lib/repositories/MediaRepository.ts
import type { Connection } from 'mongoose'

import { getMediaModel, type MediaDocument } from '../db/models/Media'
import type { Media } from '../domain/types'

export interface MediaRepository {
  getById(id: string): Promise<Media | null>
  list(limit?: number): Promise<Media[]>
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

  async list(limit = 50): Promise<Media[]> {
    const Model = getMediaModel(this.connection)
    const docs = await Model.find({}).limit(limit).lean<MediaDocument[]>().exec()
    return (docs as unknown as MediaDocument[]).map(toDomain)
  }
}
