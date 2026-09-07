// src/app/_api/fetchProduct.ts
//
// Read-only product reads for the storefront: the detail page (with
// categories, layout and related products resolved) and the paginated
// listing behind `GET /api/products`.

import { resolveStorefrontLayout } from '../../lib/repositories/adapters/layoutRelationsAdapter'
import { buildMinimalStorefrontProduct } from '../../lib/repositories/adapters/minimalProductAdapter'
import { toStorefrontProduct } from '../../lib/repositories/adapters/productStorefrontAdapter'
import type { CategoryRepository } from '../../lib/repositories/CategoryRepository'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import type { Category as NativeCategory } from '../../lib/domain/types'
import type { StorefrontProductCard, StorefrontProductDetail } from '../_types/storefront'
import { getRepositories } from './repositories'

export interface ProductDeps {
  productRepository: ProductRepository
  categoryRepository: CategoryRepository
  mediaRepository: MediaRepository
  pageRepository: PageRepository
}

/** Orchestration only — takes repository interfaces so it can be unit
 * tested with fakes. All connection wiring lives in `fetchProduct` below. */
export const buildStorefrontProduct = async (
  slug: string,
  deps: ProductDeps,
  status?: 'draft' | 'published',
): Promise<StorefrontProductDetail | null> => {
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
  ).filter((related): related is StorefrontProductCard => Boolean(related))

  return toStorefrontProduct(product, { categories, metaImage, layout, relatedProducts })
}

export const fetchProduct = async (
  slug: string,
  status?: 'draft' | 'published',
): Promise<StorefrontProductDetail | null> => {
  const { products, categories, media, pages } = await getRepositories()

  return buildStorefrontProduct(
    slug,
    {
      productRepository: products,
      categoryRepository: categories,
      mediaRepository: media,
      pageRepository: pages,
    },
    status,
  )
}

export interface ProductListQuery {
  categoryId?: string
  limit?: number
  page?: number
}

export interface ProductListResult {
  docs: StorefrontProductCard[]
  page: number
  limit: number
  hasNextPage: boolean
}

/** Orchestration only — see `buildStorefrontProduct` above.
 *
 * Published products only: an unpublished product must never be listed to
 * a customer, and the storefront list has no notion of draft preview.
 * Pagination fetches one extra record to decide `hasNextPage` without a
 * second count query. */
export const buildStorefrontProductList = async (
  query: ProductListQuery,
  deps: { productRepository: ProductRepository; mediaRepository: MediaRepository },
): Promise<ProductListResult> => {
  const limit = Math.min(Math.max(query.limit ?? 10, 1), 100)
  const page = Math.max(query.page ?? 1, 1)

  const products = await deps.productRepository.list({
    status: 'published',
    categoryId: query.categoryId,
    limit: limit + 1,
    page,
  })

  const hasNextPage = products.length > limit
  const pageProducts = hasNextPage ? products.slice(0, limit) : products

  const docs = await Promise.all(
    pageProducts.map(async product => {
      const metaImage = product.meta.imageId
        ? await deps.mediaRepository.getById(product.meta.imageId)
        : null
      return buildMinimalStorefrontProduct(product, metaImage)
    }),
  )

  return { docs, page, limit, hasNextPage }
}

export const fetchProducts = async (query: ProductListQuery = {}): Promise<ProductListResult> => {
  const { products, media } = await getRepositories()
  return buildStorefrontProductList(query, { productRepository: products, mediaRepository: media })
}

/** A single product as a card — used by `GET /api/products/[id]` when the
 * cart rehydrates from local storage. Published only, for the same reason
 * as the listing above. */
export const fetchProductCardById = async (id: string): Promise<StorefrontProductCard | null> => {
  const { products, media } = await getRepositories()
  const product = await products.getById(id)
  if (!product || product.status !== 'published') return null

  const metaImage = product.meta.imageId ? await media.getById(product.meta.imageId) : null
  return buildMinimalStorefrontProduct(product, metaImage)
}

/** Slugs for `generateStaticParams`. Published products only. */
export const fetchProductSlugs = async (): Promise<string[]> => {
  const { products } = await getRepositories()
  const all = await products.list({ status: 'published', limit: 1000 })
  return all.map(product => product.slug)
}
