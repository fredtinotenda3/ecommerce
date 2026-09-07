# PHASE 6 IMPLEMENTATION REPORT

## Admin Pages Added
All under `src/app/(native-admin)/native-admin/` (route group segment, so it does not appear in the URL), flag-gated by `USE_NATIVE_ADMIN=true` (404 when disabled/unset) **and** requiring an authorized native admin session (see Authorization Approach):

- `/native-admin` — minimal index linking to the six sections below.
- `/native-admin/products` — list: title, slug, status, price+currency, category count, updatedAt.
- `/native-admin/products/[id]` — detail: full `Product` fields (price, compareAtPrice, categories resolved to titles, related product count, paywall flag, raw layout/meta JSON).
- `/native-admin/categories` — list: title, resolved parent title, media id, createdAt, updatedAt. (No detail page — none was requested for categories.)
- `/native-admin/orders` — list: order number, resolved customer email (falls back to customer id), total+currency, status, createdAt.
- `/native-admin/orders/[id]` — detail: status, customer info, subtotal/total, line items table, associated payment records (provider, status, reference, amount).
- `/native-admin/customers` — list: name, email, roles, createdAt.
- `/native-admin/customers/[id]` — detail: profile (name, email, roles, timestamps), their orders, their purchases (resolved to product title/slug). No password/auth-internal fields — see Authorization/data-safety notes below.
- `/native-admin/pages` — list: title, slug, status, updatedAt.
- `/native-admin/pages/[id]` — detail: meta, hero, and layout blocks shown as formatted raw JSON (not re-rendered through the storefront's Blocks renderer).
- `/native-admin/media` — list: alt, filename, mimeType, dimensions, url, createdAt. (No detail page requested.)

All pages are async server components that call read-only wiring functions in `src/app/_api/adminQueries.ts`; none perform direct MongoDB queries themselves.

## Repository/Service Methods Added
Both are **read-only additions** to existing repository interfaces (no write methods added anywhere):

- `OrderRepository.list(filter?: { status?, limit?, page? }): Promise<Order[]>` — needed because the existing repository only supported `getByCustomer` (single customer) and `getById`/`getByOrderNumber`; admin needs to list orders across **all** customers. Sorted newest-first, paginated the same way `ProductRepository.list` already is.
- `UserRepository.list(filter?: { role?, limit?, page? }): Promise<User[]>` — needed because the existing repository only supported single-user lookups (`getById`/`getByEmail`); admin needs to list customers. Returns the same sanitized `User` domain shape every other `UserRepository` method already returns (no password/auth-internal fields — those live only on the separate `AuthUserRepository`/`AuthUserRecord`, which this file never imports).

New orchestration-only service layer (mirrors the existing `AuthService.ts` / `fetchProductNative.ts` split — repository-interface-only, DB-wiring kept in a separate file):

- `src/lib/services/AdminAccessService.ts` — `resolveAdminAccess(...)`: pure authorization decision (flag checks + session verification via the existing `AuthService.getCurrentUser` + `roles.isAdmin`), unit-testable with `FakeAuthUserRepository`.
- `src/lib/services/AdminQueryService.ts` — read/shaping functions for all six entities: `listAdminProducts`, `getAdminProductDetail`, `listAdminCategories`, `listAdminOrders`, `getAdminOrderDetail`, `listAdminCustomers`, `getAdminCustomerDetail`, `listAdminPages`, `getAdminPageDetail`, `listAdminMedia`. Every one takes repository interfaces only.

DB-wired entry points (mirrors `authNative.ts`):
- `src/app/_api/adminFlag.ts` — `isNativeAdminEnabled()`.
- `src/app/_api/adminAccess.ts` — `getNativeAdminAccess()`: reads the `native-session` cookie or `Authorization: Bearer` header (same extraction convention as `/api/auth-native/me`), wires `MongoAuthUserRepository`, calls `resolveAdminAccess`.
- `src/app/_api/adminQueries.ts` — DB-wired versions of every `AdminQueryService` function (`listAdminProductsNative`, `getAdminOrderDetailNative`, etc.), used directly by the page components.

## Authorization Approach
Enforced once, centrally, in `src/app/(native-admin)/native-admin/layout.tsx` (applies to every nested route):

1. If `USE_NATIVE_ADMIN` is not `'true'` → deny.
2. Else if `USE_NATIVE_AUTH` is not `'true'` → deny (native admin depends on the Phase 5 native session mechanism to authenticate; it does not add a second, separate auth system).
3. Else extract a token from the `native-session` cookie, or an `Authorization: Bearer <token>` header (useful for testing without a browser, same convention as `GET /api/auth-native/me`).
4. Verify the token via the existing `AuthService.getCurrentUser` (same HMAC session verification Phase 5 already built) and require the resolved user's roles to include `admin` (`isAdmin` from `src/lib/auth/roles.ts`).
5. Any failure at any step (flag off, no token, invalid/expired/tampered token, valid token but non-admin role, valid token for a now-deleted user) is treated **identically** — the layout calls `notFound()`, producing a **404**, never a redirect or 401/403. This matches the Phase 5 report's explicit rationale for `/api/auth-native/*` (404 over 405): the admin area should appear not to exist at all to anyone who isn't an authorized admin, rather than confirming its presence.

There is **no login UI** inside `/native-admin` (per the task) — a valid `native-session` must already exist (obtained via the Phase 5 `/api/auth-native/login` endpoint, itself gated by `USE_NATIVE_AUTH=true`) before any native-admin page will render.

Data-safety note: the `Product`/`Order`/`Category`/`Page`/`Media` domain types read by the admin pages never carried password/auth-internal fields in the first place. The `User` domain type (read by `UserRepository`, used for the customers pages) is likewise always free of `hash`/`salt`/`loginAttempts`/`lockUntil`/`resetPasswordToken`/`resetPasswordExpiration` — those fields exist only on `AuthUserRecord`, produced by the separate `AuthUserRepository`, which `AdminQueryService.ts` never imports. This is enforced structurally (by which repository/type is used), not by a manual field-stripping step, and is asserted directly in `tests/AdminQueryService.test.ts`.

## Files Created
- `src/app/_api/adminFlag.ts`
- `src/app/_api/adminAccess.ts`
- `src/app/_api/adminQueries.ts`
- `src/lib/services/AdminAccessService.ts`
- `src/lib/services/AdminQueryService.ts`
- `src/app/(native-admin)/native-admin/layout.tsx`
- `src/app/(native-admin)/native-admin/page.tsx`
- `src/app/(native-admin)/native-admin/_components/AdminTable.tsx`
- `src/app/(native-admin)/native-admin/products/page.tsx`
- `src/app/(native-admin)/native-admin/products/[id]/page.tsx`
- `src/app/(native-admin)/native-admin/categories/page.tsx`
- `src/app/(native-admin)/native-admin/orders/page.tsx`
- `src/app/(native-admin)/native-admin/orders/[id]/page.tsx`
- `src/app/(native-admin)/native-admin/customers/page.tsx`
- `src/app/(native-admin)/native-admin/customers/[id]/page.tsx`
- `src/app/(native-admin)/native-admin/pages/page.tsx`
- `src/app/(native-admin)/native-admin/pages/[id]/page.tsx`
- `src/app/(native-admin)/native-admin/media/page.tsx`
- `tests/fakes/FakeUserRepository.ts` (no fake previously existed for the storefront-safe `UserRepository`)
- `tests/adminFlag.test.ts`
- `tests/AdminAccessService.test.ts`
- `tests/AdminQueryService.test.ts`

## Files Modified
- `src/lib/repositories/OrderRepository.ts` — added `OrderListFilter` + `list()` to the interface and `MongoOrderRepository`.
- `src/lib/repositories/UserRepository.ts` — added `UserListFilter` + `list()` to the interface and `MongoUserRepository`.
- `tests/fakes/FakeOrderRepository.ts` — implemented the new `list()` method; added a `seed()` helper (mirroring the pattern already used by `FakeCategoryRepository`/`FakeProductRepository`) so admin-listing tests can seed orders directly instead of only via `create()`.

## Files Deleted
None.

## New Dependencies
None. Everything is built on repositories/services/patterns already present after Phases 1–5 (`AuthService`, `AuthUserRepository`, `session.ts`, `roles.ts`, existing `Mongo*Repository` classes) plus Next.js/React APIs already used elsewhere in the app (`cookies()`, `headers()`, `notFound()`).

## Environment Flag
`USE_NATIVE_ADMIN=true` (new). Independent of `USE_NATIVE_REPOSITORY` and `USE_NATIVE_AUTH` as separate toggles, but **functionally requires** `USE_NATIVE_AUTH=true` at runtime too, since native admin authorizes requests via the native session mechanism Phase 5 built — there is no separate admin-only auth system. When either flag is off, or the caller isn't an authorized native-admin session, every `/native-admin/*` route responds with a 404 (via Next's `notFound()`), matching the `/api/auth-native/*` precedent.

## Validation Results
- **lint**: `npm run lint` → 0 errors (`eslint src`, exit 0).
- **typecheck**: `npx tsc --noEmit` → only the same 1 pre-existing error in `src/app/_blocks/ArchiveBlock/index.tsx` reported before this phase (`Property 'sort' does not exist on type 'IntrinsicAttributes & Props'`) — unrelated to this phase's changes, untouched.
- **tests**: `npm run test` → **164 tests passing** (0 failing) across 21 test files — the pre-existing 136 plus 28 new:
  - `tests/adminFlag.test.ts` (3 tests): flag unset/false/non-`'true'`-string → false; `'true'` → true.
  - `tests/AdminAccessService.test.ts` (8 tests): flag off (either flag) → denied; no token → denied; invalid/tampered token → denied; valid token but non-admin role → denied; valid token for a deleted user → denied; valid admin token with both flags on → authorized; multi-role user including `admin` → authorized.
  - `tests/AdminQueryService.test.ts` (17 tests): output-shape assertions for products (list + detail, including category-title resolution and a `hash`/`salt`-absence check), categories (parent-title resolution, root category), orders (list across customers with resolved email, status filter, detail with items/customer/payments), customers (list shape, detail with orders/purchases, an explicit assertion that no password/auth-internal key is present), pages (list, detail with raw layout), and media (list shape). Also covers not-found (`null`) cases for every detail lookup.

_(Note: this environment had no `node_modules` installed at the start of this phase; `npm install --legacy-peer-deps` was required before any of the above would run — same peer-dependency conflict between `payload@2.3.0` and `@payloadcms/plugin-stripe`'s `payload@^1.1.8` peer range that a fresh clone of this repository would hit. No `package.json`/lockfile changes were made to work around this.)_

## Existing Payload Admin status
**Untouched.** No files under `src/payload/` were created, modified, or deleted. `/admin` (Payload's own admin UI) is unaffected and remains the only functioning admin UI unless `USE_NATIVE_ADMIN=true` is explicitly set.

## Existing Storefront status
**Untouched.** No files under `src/app/(pages)/`, `src/app/_components/`, `src/app/_blocks/`, `src/app/_heros/`, or `src/app/_providers/` were touched. The new route group lives entirely under the new `src/app/(native-admin)/` segment, which does not intersect any existing route.

## Existing Stripe/Checkout status
**Untouched.** No files under `src/lib/payments/`, `src/payload/stripe/`, or the checkout/cart pages were touched. No Paynow code was added (explicitly out of scope for this phase).

## Existing Auth status
**Untouched at the Phase 5 layer.** `src/lib/services/AuthService.ts`, `src/lib/repositories/AuthUserRepository.ts`, `src/app/_api/authNative.ts`, `src/app/_api/authFlag.ts`, and all `src/app/api/auth-native/*/route.ts` handlers are unmodified — Phase 6 only **calls** `AuthService.getCurrentUser` and `roles.isAdmin`, it does not change them. The frontend's existing Payload-based login (`src/app/_providers/Auth`) is likewise untouched; native admin still requires manually obtaining a `native-session` via the Phase 5 endpoints, exactly as the task specified.

## Remaining Risks
- **No native-admin login UI.** By design for this phase, but it means the only way to get a `native-session` for testing is via `POST /api/auth-native/login` (or `/register`, then manually promoting the account to `admin` in the database) — there is no in-product way to reach the admin area yet.
- **No revocation store for sessions**, inherited from Phase 5 — an admin's stateless HMAC session token remains valid until expiry even if, e.g., their admin role is revoked mid-session, since `getCurrentUser` re-reads the user's current roles from the DB on every call but does not re-check anything more frequently than that. (In practice this means a demoted admin loses access on their *next* request, not instantly — there's no live "kill this session" mechanism, same limitation the Phase 5 report already flagged.)
- **`Order.list()` and `User.list()` have no compound/text search or sort options beyond status/role + creation order** — fine for a foundation, but real admin usage (searching by email, order number, date range) will need richer filtering in a later phase.
- **No pagination controls in the UI** — the underlying `list()` methods support `limit`/`page`, but the pages currently call them with defaults (50 rows) and don't yet expose next/previous controls.
- **Route group and Payload admin coexistence is unverified under `npm run build`**, per the task's explicit instruction not to run it this phase. `tsc --noEmit` and `vitest` both pass, which covers type-safety and logic, but a full Next.js production build (which would also confirm route generation for the new dynatic segments) has not been executed.

## Recommended Phase 7
Given the explicit stop condition, Phase 7 should **not** begin automatically. When approved, reasonable next steps (each individually gated/approved, per the task's list of things *not* to do without explicit sign-off) would be:
1. Add a minimal native-admin login form (still separate from the storefront's Payload-based login) so testing doesn't require manually crafting `Authorization: Bearer` headers.
2. Add pagination controls and basic filtering (status, date range, search-by-email) to the list pages, using the `limit`/`page`/`status`/`role` parameters `list()` already supports.
3. Only after separate, explicit approval: begin scoping write operations (create/update/delete) for the native admin, product pricing edits, and/or order status transitions — all currently out of scope by design.
