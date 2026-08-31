# PHASE 13A — File Manifest

## Files Created (14)
- src/server.native.ts
- src/server.payload.ts
- src/app/_api/serverFlag.ts
- src/app/_api/fetchPaywallNative.ts
- src/app/api/paywall/route.ts
- src/app/_api/meNative.ts
- src/lib/repositories/adapters/userStorefrontAdapter.ts
- src/app/_components/AdminBar/shouldShowAdminBar.ts
- tests/serverFlag.test.ts
- tests/serverNative.test.ts
- tests/fetchPaywallNative.test.ts
- tests/meNative.test.ts
- tests/userStorefrontAdapter.test.ts
- tests/shouldShowAdminBar.test.ts

## Files Modified (14)
- src/server.ts (rewritten as a thin USE_NATIVE_SERVER dispatcher)
- src/lib/domain/types.ts (added `paywall: unknown[]` to the domain Product type)
- src/lib/db/models/Product.ts (declared/read the `paywall` field, previously deliberately omitted)
- src/lib/repositories/ProductRepository.ts (map `paywall` in `toDomain`)
- tests/fakes/FakeProductRepository.ts (added `paywall: []` default)
- src/app/_components/PaywallBlocks/index.tsx (fetch target changed to same-origin /api/paywall)
- src/app/_api/getAuthenticatedPayloadUser.ts (branches on USE_NATIVE_AUTH)
- src/app/_utilities/getMeUser.ts (branches on USE_NATIVE_AUTH)
- src/app/_api/getMe.ts (branches on USE_NATIVE_AUTH; unreferenced elsewhere, updated for consistency)
- src/app/_components/AdminBar/index.tsx (hides when USE_NATIVE_ADMIN=true)
- src/app/layout.tsx (passes isNativeAdminEnabled() down to AdminBar)
- .env.example (documents USE_NATIVE_SERVER=false)
- scripts/validation/checkFlags.ts (reports USE_NATIVE_SERVER status)
- package.json (adds `serve:native` script)

## Files Deleted
None.

Paths are relative to the repository root (`ecommerce-main/`). node_modules, .next,
.git, build output, and env files are excluded, per the deliverable format instructions.
