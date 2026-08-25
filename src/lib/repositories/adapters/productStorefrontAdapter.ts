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

import type { Product as PayloadProduct } from '../../../payload/payload-types'
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
   * minimalProductAdapter.ts. */
  relatedProducts: PayloadProduct[]
}

export const toStorefrontProduct = (
  product: NativeProduct,
  resolved: ResolvedProductRelations,
): PayloadProduct => {
  const result: PayloadProduct = {
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

    // Cast needed because we intentionally only populate `id`/`title`
    // (see `ResolvedProductRelations.categories` doc comment above) —
    // not the full `updatedAt`/`createdAt`/`breadcrumbs` a real Category
    // carries, since `ProductHero` never reads them.
    categories: resolved.categories.map(category => ({
      id: category.id,
      title: category.title,
    })) as PayloadProduct['categories'],

    layout: resolved.layout as PayloadProduct['layout'],

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
