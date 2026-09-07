// src/app/_api/fetchProductNative.ts
//
// PHASE 3 — flag-gated, read-only parallel data path.
//
// Mirrors `fetchDoc<Product>({ collection: 'products', slug, draft })`
// (see ./fetchDoc.ts and ../_graphql/products.ts) but reads through the
// native Mongo*Repository classes instead of Payload's GraphQL API. Only
// used when `USE_NATIVE_REPOSITORY=true`; the GraphQL path remains the
// default. See src/app/_api/dataSource.ts for the flag.
//
// This performs READS ONLY. It must never be used for create/update/delete.

import { getDbConnection } from '../../lib/db/connection'
import type { Category as NativeCategory } from '../../lib/domain/types'
import { resolveStorefrontLayout } from '../../lib/repositories/adapters/layoutRelationsAdapter'
import { buildMinimalStorefrontProduct } from '../../lib/repositories/adapters/minimalProductAdapter'
import { toStorefrontProduct } from '../../lib/repositories/adapters/productStorefrontAdapter'
import type { CategoryRepository } from '../../lib/repositories/CategoryRepository'
import { MongoCategoryRepository } from '../../lib/repositories/CategoryRepository'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import { MongoPageRepository } from '../../lib/repositories/PageRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'
import type { Product as PayloadProduct } from '../../payload/payload-types'

export interface ProductNativeDeps {
  productRepository: ProductRepository
  categoryRepository: CategoryRepository
  mediaRepository: MediaRepository
  pageRepository: PageRepository
}

/** Orchestration only — takes repository INTERFACES (not concrete Mongo
 * classes) so it can be unit tested with the existing fake-repository
 * pattern (see tests/fakes) without a database. All DB wiring lives in
 * `fetchProductNative` below. Mirrors `buildStorefrontCategories`'s shape
 * from Phase 2 (see fetchCategoriesNative.ts).
 *
 * PHASE 13S: `toStorefrontProduct` now builds and returns the narrower
 * `StorefrontProductDetail` view model (`src/app/_types/storefront.ts`)
 * with no per-field `payload-types.ts` cast inside
 * `productStorefrontAdapter.ts` — see that file's own PHASE 13S comment.
 * `buildStorefrontProduct`'s own return type stays `PayloadProduct | null`
 * unchanged, because `src/app/(pages)/products/[slug]/page.tsx` (this
 * function's one real caller) passes its `product` straight into
 * `ProductHero`, which still declares its prop against the full generated
 * `Product` type. The conversion below is the single, contained boundary
 * cast this now requires, replacing the `as PayloadProduct[...]` casts
 * that previously lived inside `productStorefrontAdapter.ts`/
 * `layoutRelationsAdapter.ts` themselves. */
export const buildStorefrontProduct = async (
  slug: string,
  deps: ProductNativeDeps,
  status?: 'draft' | 'published',
): Promise<PayloadProduct | null> => {
  const { productRepository, categoryRepository, mediaRepository, pageRepository } = deps

  const product = await productRepository.getBySlug(slug, status)
  if (!product) return null

  const categories = (
    await Promise.all(product.categories.map(id => categoryRepository.getById(id)))
  ).filter((category): category is NativeCategory => Boolean(category))

  const metaImage = product.meta.imageId
    ? await mediaRepository.getById(product.meta.imageId)
    : null

  const layout = await resolveStorefrontLayout(product.layout, {
    mediaRepository,
    pageRepository,
    productRepository,
  })

  const relatedProducts = (
    await Promise.all(
      product.relatedProducts.map(async relatedId => {
        const related = await productRepository.getById(relatedId)
        if (!related) return null

        const relatedMetaImage = related.meta.imageId
          ? await mediaRepository.getById(related.meta.imageId)
          : null

        return buildMinimalStorefrontProduct(related, relatedMetaImage)
      }),
    )
  ).filter((related): related is PayloadProduct => Boolean(related))

  const storefrontProduct = toStorefrontProduct(product, {
    categories,
    metaImage,
    layout,
    relatedProducts,
  })

  return storefrontProduct as unknown as PayloadProduct
}

/** Native equivalent of `fetchDoc<Product>({ collection: 'products', slug,
 * draft })`. `status` should be `undefined` when the caller wants draft
 * mode's "latest version regardless of status" behavior, and `'published'`
 * otherwise — see the callers in `src/app/(pages)/products/[slug]/page.tsx`. */
export const fetchProductNative = async (
  slug: string,
  status?: 'draft' | 'published',
): Promise<PayloadProduct | null> => {
  const connection = await getDbConnection()

  return buildStorefrontProduct(
    slug,
    {
      productRepository: new MongoProductRepository(connection),
      categoryRepository: new MongoCategoryRepository(connection),
      mediaRepository: new MongoMediaRepository(connection),
      pageRepository: new MongoPageRepository(connection),
    },
    status,
  )
}
