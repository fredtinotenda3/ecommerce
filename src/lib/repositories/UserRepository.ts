// src/lib/repositories/UserRepository.ts
import type { Connection, Types } from 'mongoose'

import { getUserModel, type UserDocument } from '../db/models/User'
import type { CartItem, User } from '../domain/types'

export interface UserRepository {
  getById(id: string): Promise<User | null>
  getByEmail(email: string): Promise<User | null>
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
  legacyStripeCustomerId: doc.stripeCustomerID ?? null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoUserRepository implements UserRepository {
  constructor(private readonly connection: Connection) {}

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
