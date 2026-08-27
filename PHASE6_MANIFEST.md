# Phase 6 — File Manifest

Zip: `phase6-native-admin.zip`
All paths are relative to the repository root.

## Created (21 files)
- src/app/_api/adminFlag.ts
- src/app/_api/adminAccess.ts
- src/app/_api/adminQueries.ts
- src/lib/services/AdminAccessService.ts
- src/lib/services/AdminQueryService.ts
- src/app/(native-admin)/native-admin/layout.tsx
- src/app/(native-admin)/native-admin/page.tsx
- src/app/(native-admin)/native-admin/_components/AdminTable.tsx
- src/app/(native-admin)/native-admin/products/page.tsx
- src/app/(native-admin)/native-admin/products/[id]/page.tsx
- src/app/(native-admin)/native-admin/categories/page.tsx
- src/app/(native-admin)/native-admin/orders/page.tsx
- src/app/(native-admin)/native-admin/orders/[id]/page.tsx
- src/app/(native-admin)/native-admin/customers/page.tsx
- src/app/(native-admin)/native-admin/customers/[id]/page.tsx
- src/app/(native-admin)/native-admin/pages/page.tsx
- src/app/(native-admin)/native-admin/pages/[id]/page.tsx
- src/app/(native-admin)/native-admin/media/page.tsx
- tests/fakes/FakeUserRepository.ts
- tests/adminFlag.test.ts
- tests/AdminAccessService.test.ts
- tests/AdminQueryService.test.ts

## Modified (3 files)
- src/lib/repositories/OrderRepository.ts (added read-only `list()`)
- src/lib/repositories/UserRepository.ts (added read-only `list()`)
- tests/fakes/FakeOrderRepository.ts (implemented `list()`, added `seed()`)

## Deleted
None.

## Not Included (unchanged)
Payload admin, Payload collections/config, Stripe/checkout code, storefront pages/components, Phase 5 auth service/routes/repositories — all untouched and intentionally excluded from this zip.
