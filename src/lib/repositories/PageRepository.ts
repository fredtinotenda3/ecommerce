// src/lib/repositories/PageRepository.ts
import type { Connection } from 'mongoose'
import type { Page } from '../domain/types'
import { getPageModel, type PageDocument } from '../db/models/Page'

export interface PageRepository {
  getById(id: string): Promise<Page | null>
  getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Page | null>
  list(status?: 'draft' | 'published'): Promise<Page[]>
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
  constructor(private readonly connection: Connection) {}

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
    const docs = await Model.find(query).lean<PageDocument[]>().exec()
    return (docs as unknown as PageDocument[]).map(toDomain)
  }
}