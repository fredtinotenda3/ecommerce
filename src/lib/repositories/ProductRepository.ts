// src/lib/repositories/ProductRepository.ts
//
// Repository interface + Mongo-backed implementation for Products.
//
// Services depend on the `ProductRepository` INTERFACE, never on
// `MongoProductRepository` directly, and never on Mongoose types. This is
// what makes ProductService (and friends) testable with an in-memory fake
// — see tests/fakes/FakeProductRepository.ts — without a live database.

import { type Connection, type FilterQuery, Types } from 'mongoose'

import { getProductModel, type ProductDocument } from '../db/models/Product'
import type { Product, ProductListFilter } from '../domain/types'

export interface ProductRepository {
  getById(id: string): Promise<Product | null>
  /** `status` mirrors PageRepository.getBySlug's optional status filter —
   * added in Phase 3 so the native Product detail fetch helper can
   * replicate the same draft/published distinction `fetchDoc`'s `draft`
   * flag gives the existing GraphQL path (unfiltered when omitted). */
  getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Product | null>
  list(filter?: ProductListFilter): Promise<Product[]>
  /** Sets the authoritative native price. Distinct from generic `update`
   * because pricing changes are a business-significant operation the
   * service layer should route through deliberately, not something that
   * accidentally happens as a side effect of an unrelated field edit. */
  setPrice(
    id: string,
    price: { amount: number; currency: string; compareAtPrice?: number | null },
  ): Promise<Product | null>
  update(id: string, patch: ProductWritePatch): Promise<Product | null>
  create(input: ProductWritePatch & { title: string; slug: string }): Promise<Product>
  /** Total matching `filter`, ignoring `limit`/`page`. Kept separate from
   * `list` so a caller that does not need a total does not pay for the
   * count. */
  count(filter?: ProductListFilter): Promise<number>
  delete(id: string): Promise<boolean>
}

/** Everything the admin may write on a product. `price`/`currency` are
 * deliberately absent: pricing goes through `setPrice`, so a price change
 * is always a deliberate call rather than a side effect of editing an
 * unrelated field. */
export interface ProductWritePatch {
  title?: string
  slug?: string
  status?: 'draft' | 'published'
  enablePaywall?: boolean
  categoryIds?: string[]
  relatedProductIds?: string[]
  layout?: unknown[]
  paywall?: unknown[]
  meta?: { title?: string; description?: string; imageId?: string | null }
}

const toDocumentPatch = (patch: ProductWritePatch): Record<string, unknown> => {
  const $set: Record<string, unknown> = {}

  if (typeof patch.title === 'string') $set.title = patch.title
  if (typeof patch.slug === 'string') $set.slug = patch.slug
  if (patch.status) $set._status = patch.status
  if (typeof patch.enablePaywall === 'boolean') $set.enablePaywall = patch.enablePaywall
  if (patch.categoryIds) $set.categories = patch.categoryIds.map(id => new Types.ObjectId(id))
  if (patch.relatedProductIds) {
    $set.relatedProducts = patch.relatedProductIds.map(id => new Types.ObjectId(id))
  }
  if (patch.layout !== undefined) $set.layout = patch.layout
  if (patch.paywall !== undefined) $set.paywall = patch.paywall
  if (patch.meta !== undefined) {
    $set.meta = {
      title: patch.meta.title,
      description: patch.meta.description,
      image: patch.meta.imageId ? new Types.ObjectId(patch.meta.imageId) : null,
    }
  }

  return $set
}

/** Shared by `list` and `count` so a filter can never mean one thing when
 * paging and another when counting. */
const buildListQuery = (filter: ProductListFilter): FilterQuery<ProductDocument> => {
  const query: FilterQuery<ProductDocument> = {}

  if (filter.status) query._status = filter.status
  if (filter.categoryIds?.length) {
    query.categories = { $in: filter.categoryIds.map(id => new Types.ObjectId(id)) }
  } else if (filter.categoryId) {
    query.categories = new Types.ObjectId(filter.categoryId)
  }
  if (filter.ids?.length) query._id = { $in: filter.ids }

  return query
}

const SORT_ORDERS: Record<NonNullable<ProductListFilter['sort']>, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
  title: { title: 1 },
}

const toDomain = (doc: ProductDocument): Product => ({
  id: doc._id.toString(),
  title: doc.title,
  slug: doc.slug,
  status: doc._status === 'published' ? 'published' : 'draft',
  price: typeof doc.price === 'number' ? doc.price : null,
  currency: doc.currency ?? null,
  compareAtPrice: typeof doc.compareAtPrice === 'number' ? doc.compareAtPrice : null,
  categories: (doc.categories ?? []).map((c: InstanceType<typeof Types.ObjectId>) => c.toString()),
  relatedProducts: (doc.relatedProducts ?? []).map((p: InstanceType<typeof Types.ObjectId>) =>
    p.toString(),
  ),
  enablePaywall: Boolean(doc.enablePaywall),
  // Phase 10: prefer the migration-owned `legacyStripeProductId` field once
  // it's been backfilled (see scripts/migrations/preserveProductLegacyStripeId.ts);
  // fall back to the still-present `stripeProductID` for any document the
  // backfill hasn't reached yet, so this mapping is correct before, during,
  // and after that migration runs.
  legacyStripeProductId: doc.legacyStripeProductId ?? doc.stripeProductID ?? null,
  legacyPriceJSON: doc.priceJSON ?? null,
  layout: doc.layout ?? [],
  // same untyped Mixed-passthrough treatment as `layout` —
  // see Product.ts's model comment for why this used to be
  // deliberately omitted and why it's safe to read now.
  paywall: doc.paywall ?? [],
  meta: {
    title: doc.meta?.title,
    description: doc.meta?.description,
    imageId: doc.meta?.image ? doc.meta.image.toString() : null,
  },
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
})

export class MongoProductRepository implements ProductRepository {
  private readonly connection: Connection

  constructor(connection: Connection) {
    this.connection = connection
  }

  async getById(id: string): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const doc = await Model.findById(id).lean<ProductDocument>().exec()
    return doc ? toDomain(doc as unknown as ProductDocument) : null
  }

  async getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const query: FilterQuery<ProductDocument> = { slug }
    if (status) query._status = status
    const doc = await Model.findOne(query).lean<ProductDocument>().exec()
    return doc ? toDomain(doc as unknown as ProductDocument) : null
  }

  async list(filter: ProductListFilter = {}): Promise<Product[]> {
    const Model = getProductModel(this.connection)
    const query = buildListQuery(filter)

    const limit = filter.limit ?? 50
    const page = filter.page ?? 1

    const docs = await Model.find(query)
      .sort(SORT_ORDERS[filter.sort ?? 'newest'])
      .limit(limit)
      .skip((page - 1) * limit)
      .lean<ProductDocument[]>()
      .exec()

    return (docs as unknown as ProductDocument[]).map(toDomain)
  }

  async count(filter: ProductListFilter = {}): Promise<number> {
    const Model = getProductModel(this.connection)
    return Model.countDocuments(buildListQuery(filter)).exec()
  }

  async create(input: ProductWritePatch & { title: string; slug: string }): Promise<Product> {
    const Model = getProductModel(this.connection)
    const doc = await Model.create({
      ...toDocumentPatch(input),
      _status: input.status ?? 'draft',
      categories: input.categoryIds?.map(id => new Types.ObjectId(id)) ?? [],
      relatedProducts: input.relatedProductIds?.map(id => new Types.ObjectId(id)) ?? [],
      layout: input.layout ?? [],
      paywall: input.paywall ?? [],
      enablePaywall: input.enablePaywall ?? false,
      // A new product has no price until one is set explicitly, and an
      // unpriced product is not purchasable — see pricing.ts.
      price: null,
      currency: null,
      compareAtPrice: null,
    })
    return toDomain(doc.toObject() as ProductDocument)
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

  async update(id: string, patch: ProductWritePatch): Promise<Product | null> {
    const Model = getProductModel(this.connection)
    const $set = toDocumentPatch(patch)
    if (Object.keys($set).length === 0) return this.getById(id)

    const doc = await Model.findByIdAndUpdate(id, { $set }, { new: true })
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
