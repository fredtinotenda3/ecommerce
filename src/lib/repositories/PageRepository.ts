// src/lib/repositories/PageRepository.ts
import { type Connection, Types } from 'mongoose'

import { getPageModel, type PageDocument } from '../db/models/Page'
import type { Page } from '../domain/types'

export interface PageWriteInput {
  title: string
  slug: string
  status?: 'draft' | 'published'
  layout?: unknown[]
  hero?: unknown
  meta?: { title?: string; description?: string; imageId?: string | null }
}

export interface PageRepository {
  getById(id: string): Promise<Page | null>
  getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Page | null>
  list(status?: 'draft' | 'published'): Promise<Page[]>
  create(input: PageWriteInput): Promise<Page>
  update(id: string, patch: Partial<PageWriteInput>): Promise<Page | null>
  delete(id: string): Promise<boolean>
}

/** Maps a write input onto the document shape. `status` is stored as
 * `_status` (the field the read path and every existing document use), and
 * `meta.imageId` as an ObjectId reference — an empty string clears it
 * rather than writing an unusable empty reference. */
const toDocumentPatch = (patch: Partial<PageWriteInput>): Record<string, unknown> => {
  const $set: Record<string, unknown> = {}

  if (typeof patch.title === 'string') $set.title = patch.title
  if (typeof patch.slug === 'string') $set.slug = patch.slug
  if (patch.status) $set._status = patch.status
  if (patch.layout !== undefined) $set.layout = patch.layout
  if (patch.hero !== undefined) $set.hero = patch.hero
  if (patch.meta !== undefined) {
    $set.meta = {
      title: patch.meta.title,
      description: patch.meta.description,
      image: patch.meta.imageId ? new Types.ObjectId(patch.meta.imageId) : null,
    }
  }

  return $set
}

const toDomain = (doc: PageDocument): Page => ({
  id: doc._id.toString(),
  title: doc.title,
  slug: doc.slug,
  status: doc._status === 'published' ? 'published' : 'draft',
  layout: doc.layout ?? [],
  hero: doc.hero ?? null,
  meta: {
    title: doc.meta?.title,
    description: doc.meta?.description,
    imageId: doc.meta?.image ? doc.meta.image.toString() : null,
  },
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoPageRepository implements PageRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getById(id: string): Promise<Page | null> {
    const Model = getPageModel(this.connection)
    const doc = await Model.findById(id).lean<PageDocument>().exec()
    return doc ? toDomain(doc as unknown as PageDocument) : null
  }

  async getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Page | null> {
    const Model = getPageModel(this.connection)
    const query: Record<string, unknown> = { slug }
    if (status) query._status = status
    const doc = await Model.findOne(query).lean<PageDocument>().exec()
    return doc ? toDomain(doc as unknown as PageDocument) : null
  }

  async list(status?: 'draft' | 'published'): Promise<Page[]> {
    const Model = getPageModel(this.connection)
    const query: Record<string, unknown> = {}
    if (status) query._status = status
    const docs = await Model.find(query).sort({ updatedAt: -1 }).lean<PageDocument[]>().exec()
    return (docs as unknown as PageDocument[]).map(toDomain)
  }

  async create(input: PageWriteInput): Promise<Page> {
    const Model = getPageModel(this.connection)
    const doc = await Model.create({
      ...toDocumentPatch(input),
      _status: input.status ?? 'draft',
      layout: input.layout ?? [],
      hero: input.hero ?? { type: 'none' },
    })
    return toDomain(doc.toObject() as PageDocument)
  }

  async update(id: string, patch: Partial<PageWriteInput>): Promise<Page | null> {
    const Model = getPageModel(this.connection)
    const $set = toDocumentPatch(patch)
    if (Object.keys($set).length === 0) return this.getById(id)

    const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true })
      .lean<PageDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as PageDocument) : null
  }

  async delete(id: string): Promise<boolean> {
    const Model = getPageModel(this.connection)
    const res = await Model.findByIdAndDelete(id).exec()
    return Boolean(res)
  }
}
