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
  /** Read-only admin listing. Returns the same sanitized `User` shape
   * `toDomain` produces everywhere else on this repository — no
   * `hash`/`salt`/reset-token fields, which live only on
   * `AuthUserRepository`/`AuthUserRecord` — so it is safe to render
   * directly in the admin customer views. */
  list(filter?: UserListFilter): Promise<User[]>
  updateCart(id: string, items: CartItem[]): Promise<User | null>
  /** Profile fields a customer may change about themselves. Deliberately
   * excludes `roles` and `purchases`: a customer-facing endpoint must never
   * be able to grant an account admin rights or an entitlement it did not
   * pay for. Those are admin/checkout operations and live elsewhere. */
  updateProfile(id: string, patch: { name?: string | null; email?: string }): Promise<User | null>
  /** Replaces a user's roles wholesale. Separate from `updateProfile`
   * precisely because it is a privilege change: nothing a customer can
   * reach may call this, and the admin service enforces that an operator
   * cannot strip their own admin role (see AdminContentService). */
  updateRoles(id: string, roles: Role[]): Promise<User | null>
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

  async updateRoles(id: string, roles: Role[]): Promise<User | null> {
    const Model = getUserModel(this.connection)
    const doc = await Model.findByIdAndUpdate(id, { $set: { roles } }, { new: true })
      .lean<UserDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as UserDocument) : null
  }

  async updateProfile(
    id: string,
    patch: { name?: string | null; email?: string },
  ): Promise<User | null> {
    const Model = getUserModel(this.connection)
    const $set: Record<string, unknown> = {}
    if ('name' in patch) $set.name = patch.name ?? null
    if (typeof patch.email === 'string') $set.email = patch.email

    if (Object.keys($set).length === 0) return this.getById(id)

    const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true })
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
