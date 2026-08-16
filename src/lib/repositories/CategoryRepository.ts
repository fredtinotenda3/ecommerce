// src/lib/repositories/CategoryRepository.ts
import type { Connection, Types } from 'mongoose'

import { type CategoryDocument, getCategoryModel } from '../db/models/Category'
import type { Category } from '../domain/types'

export interface CategoryRepository {
  getById(id: string): Promise<Category | null>
  list(): Promise<Category[]>
  create(input: {
    title: string
    mediaId?: string | null
    parentId?: string | null
  }): Promise<Category>
  update(
    id: string,
    patch: Partial<{ title: string; mediaId: string | null; parentId: string | null }>,
  ): Promise<Category | null>
  delete(id: string): Promise<boolean>
}

const toDomain = (doc: CategoryDocument): Category => ({
  id: doc._id.toString(),
  title: doc.title,
  mediaId: doc.media ? (doc.media as Types.ObjectId).toString() : null,
  parentId: doc.parent ? (doc.parent as Types.ObjectId).toString() : null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoCategoryRepository implements CategoryRepository {
  constructor(private readonly connection: Connection) {}

  async getById(id: string): Promise<Category | null> {
    const Model = getCategoryModel(this.connection)
    const doc = await Model.findById(id).lean<CategoryDocument>().exec()
    return doc ? toDomain(doc as unknown as CategoryDocument) : null
  }

  async list(): Promise<Category[]> {
    const Model = getCategoryModel(this.connection)
    const docs = await Model.find({}).lean<CategoryDocument[]>().exec()
    return (docs as unknown as CategoryDocument[]).map(toDomain)
  }

  async create(input: {
    title: string
    mediaId?: string | null
    parentId?: string | null
  }): Promise<Category> {
    const Model = getCategoryModel(this.connection)
    const doc = await Model.create({
      title: input.title,
      media: input.mediaId ?? undefined,
      parent: input.parentId ?? undefined,
    })
    return toDomain(doc.toObject() as CategoryDocument)
  }

  async update(
    id: string,
    patch: Partial<{ title: string; mediaId: string | null; parentId: string | null }>,
  ): Promise<Category | null> {
    const Model = getCategoryModel(this.connection)
    const $set: Record<string, unknown> = {}
    if (patch.title !== undefined) $set.title = patch.title
    if (patch.mediaId !== undefined) $set.media = patch.mediaId
    if (patch.parentId !== undefined) $set.parent = patch.parentId

    const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true })
      .lean<CategoryDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as CategoryDocument) : null
  }

  async delete(id: string): Promise<boolean> {
    const Model = getCategoryModel(this.connection)
    const res = await Model.findByIdAndDelete(id).exec()
    return Boolean(res)
  }
}
