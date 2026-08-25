// src/lib/repositories/adapters/minimalProductAdapter.ts
//
// PHASE 3 — maps a native `Product` (+ its already-resolved meta image)
// onto the narrow `Product` shape the storefront actually renders when a
// product appears as a REFERENCE inside another doc, rather than as the
// primary fetch target. Two call sites need exactly this shape today:
//
//   1. `Product.relatedProducts` on the Product detail page — see
//      src/app/_graphql/products.ts's `PRODUCT` query: `id slug title
//      ${META}` (no categories, no layout, no priceJSON even — but the
//      storefront's `Card` component *does* read `priceJSON` off any doc
//      it renders, including related products, via `RelatedProducts` ->
//      `Card`, so it is included here to avoid a silent missing price).
//   2. `Archive.populatedDocs[].value` inside a Page/Product layout block
//      — see `ARCHIVE_BLOCK`'s populatedDocs fragment: `id slug title
//      priceJSON ${PRODUCT_CATEGORIES} ${META}`.
//
// Both are rendered exclusively through `Card` (see
// src/app/_components/Card/index.tsx), which only reads: slug, title,
// categories (destructured but NOT rendered — see Phase 3 report, "fields
// intentionally not added"), meta.{description,image}, priceJSON. This
// adapter intentionally does NOT populate `categories` for referenced
// docs (Card never renders them) and never recurses into `layout` (a
// referenced product is never itself rendered as a full Product detail
// page in these two call sites, and recursing would risk unbounded
// fan-out through archive -> product -> relatedProducts -> archive...).
//
// Pure function, no I/O — the caller resolves `media` first.

import type { Product as PayloadProduct } from '../../../payload/payload-types'
import type { Media as NativeMedia, Product as NativeProduct } from '../../domain/types'
import { toStorefrontMedia } from './mediaStorefrontAdapter'

export const buildMinimalStorefrontProduct = (
  product: NativeProduct,
  metaImage: NativeMedia | null,
): PayloadProduct => {
  const result: PayloadProduct = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    // Intentionally the ONLY pricing-related field passed through for a
    // referenced product — the authoritative native `price`/`currency`
    // fields are never read here, so this can never "fall back" to
    // legacy data for a pricing DECISION; it is simply forwarding the
    // same legacy display string the GraphQL path already forwards
    // as-is, unchanged, for the existing `Price`/`Card` components.
    priceJSON: product.legacyPriceJSON ?? undefined,
    meta: {
      title: product.meta.title,
      description: product.meta.description,
      image: metaImage ? toStorefrontMedia(metaImage) : undefined,
    },
    updatedAt: product.updatedAt.toISOString(),
    createdAt: product.createdAt.toISOString(),
  }

  return result
}
