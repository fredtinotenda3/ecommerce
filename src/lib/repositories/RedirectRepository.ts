// src/lib/repositories/RedirectRepository.ts
//
// Persistence for managed redirects.

import type { Connection } from 'mongoose'

import { getRedirectModel, type RedirectDocument } from '../db/models/Redirect'
import type { Redirect } from '../domain/types'

export interface RedirectRepository {
  getById(id: string): Promise<Redirect | null>
  getByFrom(from: string): Promise<Redirect | null>
  /** All redirects, newest first. `enabledOnly` is what the request path
   * uses: a disabled rule must never be applied. */
  list(enabledOnly?: boolean): Promise<Redirect[]>
  create(input: { from: string; to: string; permanent?: boolean; enabled?: boolean }): Promise<Redirect>
  update(
    id: string,
    patch: Partial<{ from: string; to: string; permanent: boolean; enabled: boolean }>,
  ): Promise<Redirect | null>
  delete(id: string): Promise<boolean>
}

const toDomain = (doc: RedirectDocument): Redirect => ({
  id: doc._id.toString(),
  from: doc.from,
  to: doc.to,
  permanent: Boolean(doc.permanent),
  enabled: doc.enabled !== false,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoRedirectRepository implements RedirectRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getById(id: string): Promise<Redirect | null> {
    const Model = getRedirectModel(this.connection)
    const doc = await Model.findById(id).lean<RedirectDocument>().exec()
    return doc ? toDomain(doc as unknown as RedirectDocument) : null
  }

  async getByFrom(from: string): Promise<Redirect | null> {
    const Model = getRedirectModel(this.connection)
    const doc = await Model.findOne({ from }).lean<RedirectDocument>().exec()
    return doc ? toDomain(doc as unknown as RedirectDocument) : null
  }

  async list(enabledOnly = false): Promise<Redirect[]> {
    const Model = getRedirectModel(this.connection)
    const query = enabledOnly ? { enabled: { $ne: false } } : {}
    const docs = await Model.find(query).sort({ createdAt: -1 }).lean<RedirectDocument[]>().exec()
    return (docs as unknown as RedirectDocument[]).map(toDomain)
  }

  async create(input: {
    from: string
    to: string
    permanent?: boolean
    enabled?: boolean
  }): Promise<Redirect> {
    const Model = getRedirectModel(this.connection)
    const doc = await Model.create({
      from: input.from,
      to: input.to,
      permanent: input.permanent ?? false,
      enabled: input.enabled ?? true,
    })
    return toDomain(doc.toObject() as RedirectDocument)
  }

  async update(
    id: string,
    patch: Partial<{ from: string; to: string; permanent: boolean; enabled: boolean }>,
  ): Promise<Redirect | null> {
    const Model = getRedirectModel(this.connection)
    const doc = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean<RedirectDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as RedirectDocument) : null
  }

  async delete(id: string): Promise<boolean> {
    const Model = getRedirectModel(this.connection)
    const res = await Model.findByIdAndDelete(id).exec()
    return Boolean(res)
  }
}
