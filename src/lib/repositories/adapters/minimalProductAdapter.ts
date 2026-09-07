// src/lib/repositories/adapters/minimalProductAdapter.ts
//
// Maps a native `Product` (plus its already-resolved meta image) onto the
// card view model used wherever a product appears as a REFERENCE inside
// another document rather than as the primary fetch target:
//
//   1. `Product.relatedProducts` on the product detail page.
//   2. `archive.populatedDocs[].value` inside a page/product layout block.
//
// Both are rendered exclusively through `Card`, which reads slug, title,
// meta.{description,image} and the price. This deliberately does not
// recurse into `layout` or `relatedProducts`: a referenced product is never
// itself rendered as a full detail page here, and recursing would risk
// unbounded fan-out (archive -> product -> relatedProducts -> archive ...).
//
// Pure function, no I/O — the caller resolves `media` first.

import type { StorefrontProductCard } from '../../../app/_types/storefront'
import type { Media as NativeMedia, Product as NativeProduct } from '../../domain/types'
import { toStorefrontMedia } from './mediaStorefrontAdapter'
import { toStorefrontPrice } from './priceStorefrontAdapter'

export const buildMinimalStorefrontProduct = (
  product: NativeProduct,
  metaImage: NativeMedia | null,
): StorefrontProductCard => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  price: toStorefrontPrice(product),
  meta: {
    title: product.meta.title,
    description: product.meta.description,
    image: metaImage ? toStorefrontMedia(metaImage) : undefined,
  },
})
