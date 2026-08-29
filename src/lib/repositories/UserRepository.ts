// src/lib/repositories/UserRepository.ts
import type { Connection, FilterQuery, Types } from 'mongoose'

import { getUserModel, type UserDocument } from '../db/models/User'
import type { CartItem, Role, User } from '../domain/types'

export interface UserListFilter {
  role?: Role
  limit?: number
  page?: number
}

export interface UserRepository {
  getById(id: string): Promise<User | null>
  getByEmail(email: string): Promise<User | null>
  /** PHASE 6 — read-only admin listing. Returns the same sanitized `User`
   * shape `toDomain` already produces for every other method on this
   * repository (no `hash`/`salt`/reset-token fields — those only ever
   * live on `AuthUserRepository`/`AuthUserRecord`), so this is safe to
   * expose directly to the native admin customers list/detail views. */
  list(filter?: UserListFilter): Promise<User[]>
  updateCart(id: string, items: CartItem[]): Promise<User | null>
  appendPurchases(id: string, productIds: string[]): Promise<User | null>
}

const toDomain = (doc: UserDocument): User => ({
  id: doc._id.toString(),
  name: doc.name ?? null,
  email: doc.email,
  roles: (doc.roles ?? ['customer']) as User['roles'],
  purchases: (doc.purchases ?? []).map((p: Types.ObjectId) => p.toString()),
  cart: (doc.cart?.items ?? []).map(item => ({
    productId: item.product?.toString(),
    quantity: item.quantity ?? 0,
  })),
  // Phase 10: prefer the migration-owned `legacyStripeCustomerId` field once
  // it's been backfilled (see scripts/migrations/preserveUserLegacyStripeId.ts);
  // fall back to the still-present `stripeCustomerID` for any document the
  // backfill hasn't reached yet.
  legacyStripeCustomerId: doc.legacyStripeCustomerId ?? doc.stripeCustomerID ?? null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoUserRepository implements UserRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getById(id: string): Promise<User | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findById(id).lean<UserDocument>().exec()
    return doc ? toDomain(doc as unknown as UserDocument) : null
  }

  async getByEmail(email: string): Promise<User | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findOne({ email }).lean<UserDocument>().exec()
    return doc ? toDomain(doc as unknown as UserDocument) : null
  }

  async list(filter: UserListFilter = {}): Promise<User[]> {
    const Model = getUserModel(this.connection)
    const query: FilterQuery<UserDocument> = {}
    if (filter.role) query.roles = filter.role

    const limit = filter.limit ?? 50
    const page = filter.page ?? 1

    const docs = await Model.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean<UserDocument[]>()
      .exec()

    return (docs as unknown as UserDocument[]).map(toDomain)
  }

  async updateCart(id: string, items: CartItem[]): Promise<User | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findByIdAndUpdate(
      id,
      {
        $set: {
          'cart.items': items.map(i => ({ product: i.productId, quantity: i.quantity })),
        },
      },
      { new: true },
    )
      .lean<UserDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as UserDocument) : null
  }

  async appendPurchases(id: string, productIds: string[]): Promise<User | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findByIdAndUpdate(
      id,
      { $addToSet: { purchases: { $each: productIds } } },
      { new: true },
    )
      .lean<UserDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as UserDocument) : null
  }
}
