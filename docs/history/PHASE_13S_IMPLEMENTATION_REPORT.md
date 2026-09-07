# PHASE 13S IMPLEMENTATION REPORT

## Adapter Return Types Migrated
- `pageStorefrontAdapter.ts`'s `toStorefrontPage`: `Page` (from `payload-types.ts`) → `StorefrontPage` (`src/app/_types/storefront.ts`). Removed the `as PayloadPage['hero']` and `as PayloadPage['layout']` casts — `hero`/`layout` are now cast against the storefront view model's own field types instead.
- `productStorefrontAdapter.ts`'s `toStorefrontProduct`: `Product` (from `payload-types.ts`) → `StorefrontProductDetail` (`src/app/_types/storefront.ts`). Removed the `as PayloadProduct['categories']` cast entirely (no cast needed any more — the mapped `{ id, title }` shape now matches its declared field type, `StorefrontProductCategoryRef[]`, exactly) and repointed the `as PayloadProduct['layout']` cast at `StorefrontProductDetail['layout']`.
- `layoutRelationsAdapter.ts`: no longer imports `payload-types.ts` at all. `resolveMediaField`'s return type moved from `PayloadMedia` to `StorefrontMediaItem`; the `as PayloadProduct` cast in `resolveArchivePopulatedDocs` was removed outright (it was never load-bearing — `buildMinimalStorefrontProduct` already produces a compatible value, and the surrounding container field is `any`-typed regardless).

Both `pageStorefrontAdapter.ts` and `productStorefrontAdapter.ts` now build their return object with **zero** casts to `payload-types.ts` types anywhere in the file.

## View Models Added/Updated
Added to `src/app/_types/storefront.ts` (new PHASE 13S section at the end of the file):
- **`StorefrontPage`** — id, title, slug, `_status`, `hero` (typed `StorefrontHero & Record<string, unknown>`, reusing the existing Phase 13Q dispatcher view model), `layout` (typed `StorefrontLayoutBlock[]`, same Phase 13Q view model `Blocks` itself already accepts), `meta` (title/description/image, image typed `StorefrontMediaItem` — the existing Phase 13H media view model), `updatedAt`, `createdAt`.
- **`StorefrontProductDetail`** — id, title, slug, `_status`, `stripeProductID`, `priceJSON`, `enablePaywall`, `categories` (typed `StorefrontProductCategoryRef[]`), `layout` (typed `StorefrontLayoutBlock[]`), `relatedProducts` (left `unknown[]` — see "Remaining Blockers"), `meta`, `updatedAt`, `createdAt`.
- **`StorefrontProductCategoryRef`** — `{ id: string; title?: string | null }`, an exact mirror of `ResolvedProductRelations.categories`' `{ id, title }` shape, which is why the `categories` cast in `toStorefrontProduct` could be dropped entirely rather than just repointed.

No existing storefront.ts types were modified — only additions.

## Files Created
- `tests/storefrontAdapterBoundaryTypes.test.ts` — regression tests (see below).

## Files Modified
- `src/app/_types/storefront.ts`
- `src/lib/repositories/adapters/layoutRelationsAdapter.ts`
- `src/lib/repositories/adapters/pageStorefrontAdapter.ts`
- `src/lib/repositories/adapters/productStorefrontAdapter.ts`
- `src/app/_api/fetchPageNative.ts`
- `src/app/_api/fetchProductNative.ts`

`fetchPageNative.ts`/`fetchProductNative.ts` were not in the phase's original 3-file inspection list, but changing `toStorefrontPage`/`toStorefrontProduct`'s return type required a corresponding, minimal change where they're called — see "Design Note" below.

## Files Deleted
- None.

## New Dependencies
- None.

## Existing Payload Status
Untouched. Payload remains the default flag-off data source; nothing in this phase alters Payload collections, config, hooks, or the GraphQL query path.

## Existing Stripe Status
Untouched. No Stripe-related code was touched by this phase.

## Remaining payload-types Import Count
**32** (down from 35). The three target adapter files (`layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`, `productStorefrontAdapter.ts`) each dropped their `payload-types.ts` import. `fetchPageNative.ts`/`fetchProductNative.ts` still import it — see "Design Note" and "Remaining Blockers" below for why.

## Design Note — why `fetchPageNative.ts`/`fetchProductNative.ts` needed a (contained) change
Changing `toStorefrontPage`/`toStorefrontProduct`'s return type away from `PayloadPage`/`PayloadProduct` breaks compilation one level up unless something absorbs the difference, because:
- `src/app/(pages)/[slug]/page.tsx` declares `let page: Page | null` (the full generated type) and forwards `page.meta`/the whole `page` object into `generateMeta`.
- `src/app/(pages)/products/[slug]/page.tsx` passes the fetched product straight into `<ProductHero product={product} />`, whose prop type is the full generated `Product` — `ProductHero` is in the phase's own DO NOT list (`_heros/*`), so it cannot be narrowed to accept `StorefrontProductDetail` instead.

Per Task step 5 ("ensure existing pages/components... continue to compile and render unchanged") and the DO NOT list, those two route files and `ProductHero` had to stay untouched. The resolution: `buildStorefrontPage`/`buildStorefrontProduct` (in `fetchPageNative.ts`/`fetchProductNative.ts` — the actual "fetch compatibility layer" this phase is named for) keep their **public return type** exactly as before (`PayloadPage | null` / `PayloadProduct | null`), but now reach it via **one single, explicitly documented conversion** at the very end of each function, replacing the several scattered per-field `as PayloadPage[...]`/`as PayloadProduct[...]` casts that used to live inside the three adapter files. This is a net reduction in both the number of casts and how spread-out they are, while leaving every existing consumer's compiled behavior identical (verified — see below).

## Remaining Blockers
- `StorefrontProductDetail.relatedProducts` and `StorefrontPage`/`StorefrontProductDetail`'s eventual full un-coupling from `payload-types.ts` are blocked on `RelatedProducts`/`Card` (`src/app/_blocks/RelatedProducts/index.tsx`, `src/app/_components/Card/index.tsx`) and `ProductHero` (`src/app/_heros/Product/index.tsx`) still declaring their own props against the full generated `Product`/`Page` types. All three are `_blocks/*`/`_heros/*` components explicitly out of this phase's scope (per the DO NOT list). Until a future phase narrows those components' own prop types (the same way Phase 13L/13Q did for the block/hero leaf and dispatcher layers), the single boundary conversion in `fetchPageNative.ts`/`fetchProductNative.ts` is the natural remaining edge of this migration.
- The pre-existing `sort` prop type error in `src/app/_blocks/ArchiveBlock/index.tsx` (unrelated to this phase — confirmed present in the unmodified codebase via a side-by-side `tsc` run) is still there; not touched, as `_blocks/*` is out of scope.

## Recommended Next Phase
**Phase 13T** — narrow `RelatedProducts`/`Card`'s prop types to a `StorefrontProductSummary`-style view model (mirroring `minimalProductAdapter.ts`'s actual output shape), which would let `StorefrontProductDetail.relatedProducts` become a real typed array instead of `unknown[]`, and is the last piece standing between the adapter/fetch boundary and a fully Payload-type-free native product read path.
