# Phase 3 — File Manifest

Zip: `phase3-native-product-page-changes.zip`
All paths are relative to the repository root.

## Modified

- src/lib/domain/types.ts
- src/lib/db/models/Product.ts
- src/lib/db/models/Media.ts
- src/lib/repositories/ProductRepository.ts
- src/lib/repositories/MediaRepository.ts
- src/app/(pages)/products/[slug]/page.tsx
- src/app/(pages)/[slug]/page.tsx
- tests/fakes/FakeProductRepository.ts
- tests/fakes/FakeMediaRepository.ts

## Created

- src/lib/repositories/adapters/mediaStorefrontAdapter.ts
- src/lib/repositories/adapters/minimalProductAdapter.ts
- src/lib/repositories/adapters/layoutRelationsAdapter.ts
- src/lib/repositories/adapters/productStorefrontAdapter.ts
- src/lib/repositories/adapters/pageStorefrontAdapter.ts
- src/app/_api/fetchProductNative.ts
- src/app/_api/fetchPageNative.ts
- tests/fakes/FakePageRepository.ts
- tests/productStorefrontAdapter.test.ts
- tests/pageStorefrontAdapter.test.ts
- tests/layoutRelationsAdapter.test.ts
- tests/fetchProductNative.test.ts
- tests/fetchPageNative.test.ts

## Deleted

None.
