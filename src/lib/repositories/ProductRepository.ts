// src/lib/repositories/ProductRepository.ts
//
// Repository interface + Mongo-backed implementation for Products.
//
// Services depend on the `ProductRepository` INTERFACE, never on
// `MongoProductRepository` directly, and never on Mongoose types. This is
// what makes ProductService (and friends) testable with an in-memory fake
// — see tests/fakes/FakeProductRepository.ts — without a live database.

import type { Connection, FilterQuery, Types } from 'mongoose'

import { getProductModel, type ProductDocument } from '../db/models/Product'
import type { Product, ProductListFilter } from '../domain/types'

export interface ProductRepository {
  getById(id: string): Promise<Product | null>
  getBySlug(slug: string): Promise<Product | null>
  list(filter?: ProductListFilter): Promise<Product[]>
  /** Sets the authoritative native price. Distinct from generic `update`
   * because pricing changes are a business-significant operation the
   * service layer should route through deliberately, not something that
   * accidentally happens as a side effect of an unrelated field edit. */
  setPrice(
    id: string,
    price: { amount: number; currency: string; compareAtPrice?: number | null },
  ): Promise<Product | null>
  update(
    id: string,
    patch: Partial<Pick<Product, 'title' | 'slug' | 'enablePaywall'>>,
  ): Promise<Product | null>
  delete(id: string): Promise<boolean>
}

const toDomain = (doc: ProductDocument): Product => ({
  id: doc._id.toString(),
  title: doc.title,
  slug: doc.slug,
  status: doc._status === 'published' ? 'published' : 'draft',
  price: typeof doc.price === 'number' ? doc.price : null,
  currency: doc.currency ?? null,
  compareAtPrice: typeof doc.compareAtPrice === 'number' ? doc.compareAtPrice : null,
  categories: (doc.categories ?? []).map((c: Types.ObjectId) => c.toString()),
  relatedProducts: (doc.relatedProducts ?? []).map((p: Types.ObjectId) => p.toString()),
  enablePaywall: Boolean(doc.enablePaywall),
  legacyStripeProductId: doc.stripeProductID ?? null,
  legacyPriceJSON: doc.priceJSON ?? null,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoProductRepository implements ProductRepository {
  constructor(private readonly connection: Connection) {}

  async getById(id: string): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const doc = await Model.findById(id).lean<ProductDocument>().exec()
    return doc ? toDomain(doc as unknown as ProductDocument) : null
  }

  async getBySlug(slug: string): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const doc = await Model.findOne({ slug }).lean<ProductDocument>().exec()
    return doc ? toDomain(doc as unknown as ProductDocument) : null
  }

  async list(filter: ProductListFilter = {}): Promise<Product[]> {
    const Model = getProductModel(this.connection)
    const query: FilterQuery<ProductDocument> = {}

    if (filter.status) {
      query._status = filter.status
    }
    if (filter.categoryId) {
      query.categories = filter.categoryId
    }
    if (filter.ids?.length) {
      query._id = { $in: filter.ids }
    }

    const limit = filter.limit ?? 50
    const page = filter.page ?? 1

    const docs = await Model.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean<ProductDocument[]>()
      .exec()

    return (docs as unknown as ProductDocument[]).map(toDomain)
  }

  async setPrice(
    id: string,
    price: { amount: number; currency: string; compareAtPrice?: number | null },
  ): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const doc = await Model.findByIdAndUpdate(
      id,
      {
        $set: {
          price: price.amount,
          currency: price.currency,
          compareAtPrice: price.compareAtPrice ?? null,
        },
      },
      { new: true },
    )
      .lean<ProductDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as ProductDocument) : null
  }

  async update(
    id: string,
    patch: Partial<Pick<Product, 'title' | 'slug' | 'enablePaywall'>>,
  ): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const doc = await Model.findByIdAndUpdate(id, { $set: patch }, { new: true })
      .lean<ProductDocument>()
      .exec()
    return doc ? toDomain(doc as unknown as ProductDocument) : null
  }

  async delete(id: string): Promise<boolean> {
    const Model = getProductModel(this.connection)
    const res = await Model.findByIdAndDelete(id).exec()
    return Boolean(res)
  }
}
