# PHASE 13S — File Manifest

## Modified
- `src/app/_types/storefront.ts`
  Added `StorefrontPage`, `StorefrontProductDetail`, `StorefrontProductCategoryRef`.
- `src/lib/repositories/adapters/layoutRelationsAdapter.ts`
  Dropped `payload-types.ts` import; `resolveMediaField` now returns `StorefrontMediaItem`; removed the redundant `as PayloadProduct` cast in `resolveArchivePopulatedDocs`.
- `src/lib/repositories/adapters/pageStorefrontAdapter.ts`
  `toStorefrontPage` now returns `StorefrontPage` instead of `PayloadPage`; casts point at storefront types, not Payload types.
- `src/lib/repositories/adapters/productStorefrontAdapter.ts`
  `toStorefrontProduct` now returns `StorefrontProductDetail` instead of `PayloadProduct`; the `categories` cast is eliminated entirely (no cast needed — the built shape matches the declared type exactly).
- `src/app/_api/fetchPageNative.ts`
  `buildStorefrontPage` still returns `PayloadPage | null` (public contract unchanged for `[slug]/page.tsx`), now via one single, documented boundary conversion instead of relying on per-field casts inside the adapter.
- `src/app/_api/fetchProductNative.ts`
  `buildStorefrontProduct` still returns `PayloadProduct | null` (public contract unchanged for `products/[slug]/page.tsx` → `ProductHero`), same single-boundary-conversion treatment.

## Created
- `tests/storefrontAdapterBoundaryTypes.test.ts`
  Regression tests: (1) `StorefrontPage`/`StorefrontProductDetail` still accept every real `payload-types.ts` `Page`/`Product` shape, (2) `buildStorefrontPage`/`buildStorefrontProduct` still return values `Hero`/`Blocks`/`ProductHero` accept unchanged, (3) `StorefrontProductCategoryRef` needs no cast for the shape `toStorefrontProduct` actually builds.

## Deleted
- None

## Verification performed
- `npx tsc --noEmit -p tsconfig.json` — identical single pre-existing, unrelated error (`ArchiveBlock/index.tsx`'s `sort` prop) before and after this phase's changes; no new errors.
- `npx vitest run` — 56 test files / 446 tests pass (441 pre-existing + 5 new).
- `npx eslint src/...` (the 6 modified `src/` files) — clean.
- Manual `payload-types.ts` import count check: 35 → 32 (the 3 target adapter files dropped the import; `fetchPageNative.ts`/`fetchProductNative.ts` still import it for the single documented boundary conversion).
