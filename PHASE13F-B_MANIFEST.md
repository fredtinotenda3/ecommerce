# PHASE 13F-B MANIFEST

## New files (2)
- src/app/_types/storefront.ts
- tests/priceFromJSON.test.ts

## Modified files (8)
- src/app/_components/Price/index.tsx
- src/app/_components/Link/index.tsx
- src/app/_components/Categories/CategoryCard/index.tsx
- src/app/_components/Categories/index.tsx
- src/app/(pages)/products/Filters/index.tsx
- src/app/(pages)/cart/CartPage/index.tsx
- src/app/(pages)/logout/LogoutPage/index.tsx
- src/app/(pages)/checkout/CheckoutPage/index.tsx

## Deleted files
None. `payload-types.ts` itself is untouched. `CartPage/index.tsx` keeps
its `Page` import (for its unused-but-still-typed `page` prop) — only
its `Settings` import was replaced.

## Not migrated (audited, left on payload-types.ts — see report)
57 of the 65 audited files remain unchanged, including all repository
adapters, native fetch helpers, the Cart provider/reducer, Auth
provider, `fetchDoc`/`fetchDocs`, and every component that consumes a
populated relation, a CMS `layout`/block union, or `Media.sizes`.
