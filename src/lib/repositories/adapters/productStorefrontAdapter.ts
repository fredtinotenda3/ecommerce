// src/lib/repositories/adapters/productStorefrontAdapter.ts
//
// Maps a native domain `Product` (plus its already-resolved relations) onto
// the `StorefrontProductDetail` view model the product detail page renders:
// what `ProductHero`, `Price`, `AddToCartButton`, `Blocks` and
// `RelatedProducts`/`Card` read, and nothing more.
//
// Pure function, no I/O — categories, meta image, layout and related
// products are resolved by the caller (see fetchProduct.ts).

import type {
  StorefrontProductCard,
  StorefrontProductCategoryRef,
  StorefrontProductDetail,
} from '../../../app/_types/storefront'
import type {
  Category as NativeCategory,
  Media as NativeMedia,
  Product as NativeProduct,
} from '../../domain/types'
import { toStorefrontMedia } from './mediaStorefrontAdapter'
import { toStorefrontCompareAtPrice, toStorefrontPrice } from './priceStorefrontAdapter'

export interface ResolvedProductRelations {
  /** Only `id`/`title` are populated: `ProductHero` reads nothing else off
   * a category. */
  categories: Array<Pick<NativeCategory, 'id' | 'title'>>
  metaImage: NativeMedia | null
  /** Already relation-resolved via `resolveStorefrontLayout`. */
  layout: unknown[]
  /** Already mapped via `buildMinimalStorefrontProduct`. */
  relatedProducts: StorefrontProductCard[]
}

export const toStorefrontProduct = (
  product: NativeProduct,
  resolved: ResolvedProductRelations,
): StorefrontProductDetail => {
  const categories: StorefrontProductCategoryRef[] = resolved.categories.map(category => ({
    id: category.id,
    title: category.title,
  }))

  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    _status: product.status,
    price: toStorefrontPrice(product),
    compareAtPrice: toStorefrontCompareAtPrice(product),
    enablePaywall: product.enablePaywall,
    categories,
    layout: resolved.layout as StorefrontProductDetail['layout'],
    relatedProducts: resolved.relatedProducts,
    meta: {
      title: product.meta.title,
      description: product.meta.description,
      image: resolved.metaImage ? toStorefrontMedia(resolved.metaImage) : undefined,
    },
    updatedAt: product.updatedAt.toISOString(),
    createdAt: product.createdAt.toISOString(),
  }
}
