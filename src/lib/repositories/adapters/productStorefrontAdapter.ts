// src/lib/repositories/adapters/productStorefrontAdapter.ts
//
// Phase 3: maps a native domain `Product` (plus its already-resolved
// relations) onto the exact shape the storefront's Product detail page
// already expects from `payload-types.ts`'s `Product` — mirrors the
// `PRODUCT` GraphQL query field-for-field (see src/app/_graphql/products.ts):
// id, title, stripeProductID, categories { title, id }, layout, priceJSON,
// enablePaywall, relatedProducts, meta.
//
// This is a deliberately narrow, storefront-READ-only adapter for exactly
// what `ProductHero`, `Price`, `AddToCartButton`, `Blocks`, and the
// `RelatedProducts`/`Card` components read — see the Phase 3 report for
// the full list of fields intentionally NOT populated (e.g. category
// `breadcrumbs`, which `ProductHero` never reads).
//
// Pure function, no I/O — `categories`/`metaImage`/`layout`/
// `relatedProducts` are already-resolved by the caller (see
// fetchProductNative.ts), same division of responsibility as
// `categoryStorefrontAdapter.ts`.
//
// ---------------------------------------------------------------------
// PHASE 13S — return a `StorefrontProductDetail` view model instead of
// `PayloadProduct`
// ---------------------------------------------------------------------
//
// `toStorefrontProduct` used to build a `PayloadProduct` (`payload-types.ts`)
// directly, which needed an `as PayloadProduct['categories']` cast for the
// mapped `{ id, title }` category array (it doesn't match the full,
// generated `Category[]`/`string[]` union) and an
// `as PayloadProduct['layout']` cast for the same reason `pageStorefrontAdapter.ts`
// needed one (`resolved.layout` is `unknown[]`, straight from
// `layoutRelationsAdapter.ts`).
//
// This function now returns `StorefrontProductDetail`
// (`src/app/_types/storefront.ts`) instead — `categories` is typed against
// the dedicated `StorefrontProductCategoryRef` view model (an exact match
// for the `{ id, title }` shape actually built below, so no cast is needed
// at all any more) and `layout` against the Phase 13Q `StorefrontLayoutBlock`
// dispatcher view model, same as `pageStorefrontAdapter.ts`. This drops the
// `Product as PayloadProduct` import from this file entirely.
//
// The caller (`fetchProductNative.ts`'s `buildStorefrontProduct`) is
// responsible for the one remaining conversion back to `payload-types.ts`'s
// `Product` — still needed today because `ProductHero`
// (`src/app/_heros/Product/index.tsx`) declares its `product` prop against
// the full generated type — see that file's own PHASE 13S comment.

import type {
  StorefrontProductCategoryRef,
  StorefrontProductDetail,
} from '../../../app/_types/storefront'
import type {
  Category as NativeCategory,
  Media as NativeMedia,
  Product as NativeProduct,
} from '../../domain/types'
import { toStorefrontMedia } from './mediaStorefrontAdapter'

export interface ResolvedProductRelations {
  /** Only `id`/`title` are populated by the caller — `ProductHero` is the
   * only consumer and it only ever reads `category.title` (see Phase 3
   * report: category `breadcrumbs` intentionally not added). */
  categories: Array<Pick<NativeCategory, 'id' | 'title'>>
  metaImage: NativeMedia | null
  /** Already relation-resolved via `resolveStorefrontLayout` — see
   * layoutRelationsAdapter.ts. */
  layout: unknown[]
  /** Already mapped via `buildMinimalStorefrontProduct` — see
   * minimalProductAdapter.ts. Left opaque (`unknown[]`) rather than typed
   * against `payload-types.ts`'s `Product[]` — see `StorefrontProductDetail`'s
   * own `relatedProducts` doc comment (`src/app/_types/storefront.ts`) for
   * why. */
  relatedProducts: unknown[]
}

export const toStorefrontProduct = (
  product: NativeProduct,
  resolved: ResolvedProductRelations,
): StorefrontProductDetail => {
  const categories: StorefrontProductCategoryRef[] = resolved.categories.map(category => ({
    id: category.id,
    title: category.title,
  }))

  const result: StorefrontProductDetail = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    _status: product.status,

    // Legacy/native pricing fields — passed through UNCHANGED. The
    // native path never derives `priceJSON` from `product.price`, nor
    // vice versa; it forwards exactly what's stored, exactly like the
    // GraphQL path does today.
    stripeProductID: product.legacyStripeProductId ?? undefined,
    priceJSON: product.legacyPriceJSON ?? undefined,

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

  return result
}
