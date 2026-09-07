# PHASE 13A IMPLEMENTATION REPORT

Payload was NOT removed and remains fully intact and required. This phase only closes
the gaps Phase 13's readiness report identified, all behind new/existing flags that
default OFF. With every flag unset, the application is byte-for-byte behaviorally
unchanged from Phase 12.

## Server Bootstrap Changes

`src/server.ts` is now a thin dispatcher. Its existing behavior (dotenv load, then
`payload.init()` wrapped by Express, then Next.js) was extracted verbatim into
`src/server.payload.ts` (`startPayloadServer()`) — same log lines, same `NEXT_BUILD`/
`PAYLOAD_SEED` handling, no behavior change.

A new `src/server.native.ts` (`startNativeServer()`) boots a plain Next.js app and never
imports `payload`, `@payloadcms/*`, or anything under `src/payload/**`. It doesn't need a
local Payload/Express loopback server during `NEXT_BUILD` either — the native storefront
repositories talk to MongoDB directly (`getDbConnection()`), not over HTTP — so `next
build` runs straight against the DB in that mode.

`src/server.ts` picks a branch at runtime via `require()` (not a static `import`), gated
by the new `USE_NATIVE_SERVER` flag (`src/app/_api/serverFlag.ts`, default `false`).
Default/unset: `startPayloadServer()`, unchanged. `USE_NATIVE_SERVER=true`:
`startNativeServer()`, Payload never initializes. Added `serve:native` to `package.json`
and wired the flag into `scripts/validation/checkFlags.ts` for visibility, matching the
convention of the other four flags.

**Caveat carried over from the design, not a bug**: `USE_NATIVE_SERVER=true` is only
meaningful today alongside `USE_NATIVE_REPOSITORY=true` — with the server flag on but the
repository flag off, storefront reads would still try to hit Payload's GraphQL API over
HTTP with nothing there to answer them. This is documented in `server.native.ts`'s header
comment and `checkFlags.ts`'s description; it isn't hidden.

`src/server.default.ts`/`src/server.prod.ts` (alternate eject/prod builds) were left
untouched — out of scope for this phase, called out again under "Remaining Blockers."

## PaywallBlocks Native Path

Closed the gap Phase 13 flagged: `PaywallBlocks` had **no native path and no flag at
all** — it called Payload's `/api/graphql` directly and unconditionally.

- Added a `paywall` field to the native `Product` domain type, the Mongoose model
  (`src/lib/db/models/Product.ts` — previously *deliberately* undeclared, per that file's
  own Phase 3 comment), and `ProductRepository.toDomain`.
- New `src/app/_api/fetchPaywallNative.ts` reproduces Payload's field-level access control
  for `paywall` (`src/payload/collections/Products/access/checkUserPurchases.ts`
  exactly: no user → false; admin → true; otherwise → product id must be in the user's
  `purchases`) as a pure, separately-tested `canReadPaywall` function, then resolves the
  authorized block tree's relations via the existing `resolveStorefrontLayout` helper
  (same block types — cta/content/mediaBlock/archive — already shared with `layout`).
- New `src/app/api/paywall/route.ts` (`POST /api/paywall`) is a same-origin route the
  client now calls instead of `/api/graphql` directly. The **server**, not the client,
  decides whether to serve native content (`USE_NATIVE_REPOSITORY=true`) or proxy
  Payload's GraphQL API (default, response forwarded byte-for-byte with the caller's
  cookies attached, so Payload's own auth/behavior is completely unaffected when the
  flag is off). Response shape is identical either way:
  `{ data: { Products: { docs: [{ paywall }] } } }`.
- `PaywallBlocks/index.tsx`'s only change is its fetch target and request body (URL +
  `{ slug }` instead of a GraphQL query/variables payload) — every other line, including
  all UI states and the `res?.data?.Products.docs[0]?.paywall` response parsing, is
  unchanged.

**Known remaining gap, called out rather than papered over**: the *decision* to fetch at
all (`user === null/undefined` gating in `PaywallBlocks`) and the identity the `/api/paywall`
route resolves both still ultimately depend on whichever cookie is present. The client-side
`useAuth()`/`AuthProvider` (`src/app/_providers/Auth/index.tsx`) was **not** modified — it
still calls Payload's own `/api/users/*` endpoints exclusively, issuing only a
`payload-token` cookie, regardless of any flag. That provider was explicitly out of this
phase's file list and explicitly out of scope ("DO NOT change auth UX"). Practical
consequence: today, a real end-to-end "logged in via native auth only" browser session
doesn't exist yet, so the native paywall path's user-resolution branch (below) is
exercised in tests and by design, but not yet by real browser traffic. See "Remaining
Blockers."

## Native Auth Identity Resolution

`getMeUser.ts`, `getMe.ts`, and `getAuthenticatedPayloadUser.ts` now branch on
`USE_NATIVE_AUTH` (`src/app/_api/authFlag.ts`, unchanged from Phase 5, still defaults
`false`):

- **Off (default)**: byte-for-byte the same Payload-backed logic as before in all three
  files.
- **On**: identity is resolved via the `native-session` cookie
  (`NATIVE_SESSION_COOKIE`, reused from `src/app/api/auth-native/_shared/respond.ts` —
  same constant the `/api/auth-native/*` routes already use, imported rather than
  duplicated) and `AuthService.getCurrentUser` (unchanged from Phase 5) — **not** as a
  fallback, but as the only path consulted, per the task's explicit instruction. This is a
  hard switch: with the flag on, a request carrying only a `payload-token` (no
  `native-session`) resolves to "not logged in" in these three functions.

New supporting files:
- `src/lib/repositories/adapters/userStorefrontAdapter.ts` — pure mapping from the native
  domain `User` (id/name/email/roles/purchases/cart/legacyStripeCustomerId/timestamps) onto
  the exact `payload-types.ts` `User` shape `getMeUser`/`getMe` already return.
  `purchases` is returned as bare string ids (not populated `Product[]`) — `User.purchases`
  is typed `string[] | Product[]`, and the one real consumer
  (`account/purchases/page.tsx`) already branches on `typeof purchase === 'string'`, so
  this needed no new product-population logic to stay compatible.
- `src/app/_api/meNative.ts` — DB-wired orchestration (`getMeNative`,
  `getAuthenticatedNativeUser`) plus deps-injectable, unit-tested pure functions
  (`resolveMeNative`, `resolveAuthenticatedNativeUser`) following the same
  `buildStorefrontProduct`/`fetchProductNative` split used throughout the codebase.

**The Phase 8 Paynow checkout route needed zero changes** to pick up native auth: it
already only calls `getAuthenticatedPayloadUser()` and only ever consumed the narrow
`{ id, email }` shape, which is unchanged. It now automatically follows whichever auth
system `USE_NATIVE_AUTH` selects.

`getMe.ts` was confirmed (via repo-wide search) to be dead code — imported nowhere — but
was updated anyway per this phase's explicit instructions, so it doesn't silently drift
out of sync if something starts importing it later.

## AdminBar Handling

Repointing `AdminBar` at `/native-admin` wasn't clean: `/native-admin` (Phase 6) is
read-only and has no per-document deep-link equivalent to what `PayloadAdminBar` provides
(it links directly into Payload admin's edit view for the current collection/document). Per
the task's own fallback instruction, went with **hide, not repoint**.

- New pure `src/app/_components/AdminBar/shouldShowAdminBar.ts` — `{ nativeAdminEnabled,
  isAdmin } → boolean`; hides unconditionally when `nativeAdminEnabled` is true, otherwise
  unchanged (`isAdmin`-gated) behavior. Extracted as a pure function specifically so it's
  unit-testable without a React rendering environment — this repo has no
  component-testing setup, and adding one (`@testing-library/react`, `jsdom`) would have
  meant a new dependency, which this phase's instructions said to avoid unless
  absolutely necessary.
- `AdminBar/index.tsx` takes a new optional `nativeAdminEnabled` prop (default `false`,
  so omitting it preserves prior behavior exactly) and calls `shouldShowAdminBar` before
  rendering.
- `layout.tsx` resolves `isNativeAdminEnabled()` server-side (it's not a
  `NEXT_PUBLIC_`-prefixed flag, so the client component can't read it directly) and passes
  it down as a plain boolean prop.

## Payload Dependency Readiness After Changes

Re-ran the Phase 13 search method with all four native flags (`USE_NATIVE_REPOSITORY`,
`USE_NATIVE_AUTH`, `USE_NATIVE_ADMIN`, `USE_NATIVE_SERVER`) hypothetically ON.

**Closed by this phase:**
- Server bootstrap no longer requires Payload (`USE_NATIVE_SERVER=true`).
- `PaywallBlocks` now has a real native path with no unconditional GraphQL dependency
  (`USE_NATIVE_REPOSITORY=true`).
- `getMeUser`/`getMe`/`getAuthenticatedPayloadUser` now actually resolve identity
  natively when `USE_NATIVE_AUTH=true`, instead of the flag only gating route
  reachability as Phase 13 found.
- `AdminBar` no longer unconditionally points at Payload's admin.

**Still open (see "Remaining Blockers" for detail):**
- The `/admin` Payload admin panel itself and all of `src/payload/**` (collections,
  hooks, Stripe plugin/webhook endpoints, seed data) are completely untouched — still
  required, still the only admin UI Payload's own `/admin` route serves.
- The frontend `AuthProvider`/`useAuth()` still exclusively calls Payload's own
  `/api/users/*` endpoints and issues only the `payload-token` cookie — meaning
  `USE_NATIVE_AUTH=true` has no real browser traffic to exercise it against yet, even
  though the server-side logic is now correct and tested.
- Checkout's default (flag-off) path is still Payload's own Stripe plugin
  (`@payloadcms/plugin-stripe`, `src/payload/endpoints/create-payment-intent.ts`) —
  entirely out of scope (Phase 14).
- `src/server.default.ts`/`src/server.prod.ts` were not decoupled — only `src/server.ts`
  was, per this phase's explicit task list.

**Conclusion: Payload removal is still not safe.** This phase made it *possible* for
several previously-blocking paths to run without Payload when their flags are on, but did
not flip any flag to on-by-default, did not touch `/admin` or `src/payload/**`, and did not
touch the frontend login/session-issuing code. A real Phase 13 re-run (with the native
flags actually live in production for a validated period, not just present in code) is
still the right gate before attempting removal.

## Files Created

- `src/server.native.ts`
- `src/server.payload.ts`
- `src/app/_api/serverFlag.ts`
- `src/app/_api/fetchPaywallNative.ts`
- `src/app/api/paywall/route.ts`
- `src/app/_api/meNative.ts`
- `src/lib/repositories/adapters/userStorefrontAdapter.ts`
- `src/app/_components/AdminBar/shouldShowAdminBar.ts`
- `tests/serverFlag.test.ts`
- `tests/serverNative.test.ts`
- `tests/fetchPaywallNative.test.ts`
- `tests/meNative.test.ts`
- `tests/userStorefrontAdapter.test.ts`
- `tests/shouldShowAdminBar.test.ts`

## Files Modified

- `src/server.ts` — rewritten as a thin `USE_NATIVE_SERVER` dispatcher
- `src/lib/domain/types.ts` — added `paywall: unknown[]` to the domain `Product` type
- `src/lib/db/models/Product.ts` — declared/read the `paywall` field (previously
  deliberately omitted)
- `src/lib/repositories/ProductRepository.ts` — map `paywall` in `toDomain`
- `tests/fakes/FakeProductRepository.ts` — added `paywall: []` default
- `src/app/_components/PaywallBlocks/index.tsx` — fetch target changed to same-origin
  `/api/paywall`
- `src/app/_api/getAuthenticatedPayloadUser.ts` — branches on `USE_NATIVE_AUTH`
- `src/app/_utilities/getMeUser.ts` — branches on `USE_NATIVE_AUTH`
- `src/app/_api/getMe.ts` — branches on `USE_NATIVE_AUTH` (unreferenced elsewhere,
  updated for consistency per the task's file list)
- `src/app/_components/AdminBar/index.tsx` — hides when `USE_NATIVE_ADMIN=true`
- `src/app/layout.tsx` — passes `isNativeAdminEnabled()` down to `AdminBar`
- `.env.example` — documents `USE_NATIVE_SERVER=false` (excluded from the zip per the
  deliverable format's "no env files" rule; the exact three added lines are quoted below)
- `scripts/validation/checkFlags.ts` — reports `USE_NATIVE_SERVER` status
- `package.json` — adds a `serve:native` script

`.env.example` diff (for reference, since the file itself isn't in the zip):
```
# PHASE 13A: gates which boot path src/server.ts delegates to. Off (default)
# = existing Payload+Express+Next.js server, unchanged. On = plain Next.js
# boot that never initializes Payload (src/server.native.ts) — only
# meaningful in practice alongside USE_NATIVE_REPOSITORY=true.
USE_NATIVE_SERVER=false
```

## Files Deleted

None.

## New Dependencies

None added.

## New Flags Added

- `USE_NATIVE_SERVER` (`src/app/_api/serverFlag.ts`) — default `false`/unset. Gates which
  module `src/server.ts` delegates boot to. See "Server Bootstrap Changes" above.

`USE_NATIVE_REPOSITORY`, `USE_NATIVE_AUTH`, and `USE_NATIVE_ADMIN` are unchanged — this
phase makes them do more (real identity resolution, real paywall data, a real
non-Payload boot path) when set, but doesn't change their names, defaults, or
independence from one another.

## Validation Results

- **lint**: `npm run lint` → 0 errors (after auto-fixing import ordering/formatting on
  the new files with `eslint --fix`, and correcting the ESLint rule name in
  `server.ts`'s disable comments for the two intentional `require()` calls)
- **typecheck**: `npx tsc --noEmit` → only the same 1 pre-existing, unrelated error in
  `src/app/_blocks/ArchiveBlock/index.tsx` (present since at least Phase 12; confirmed
  untouched by this phase)
- **tests**: `npm run test` → **294 passed** (258 inherited + 36 new, across 6 new test
  files: `serverFlag`, `serverNative`, `fetchPaywallNative`, `meNative`,
  `userStorefrontAdapter`, `shouldShowAdminBar`)
- **flags/db/paynow/stripe validation**:
  - `npm run validate:flags` → all five flags report OFF/unset; explicitly confirms "this
    environment is behaviorally identical to pre-Phase-2 production"
  - `npm run validate:db` → FAILs with "DATABASE_URI is not set" — expected in this
    sandbox (no database/environment configured here, same limitation noted in prior
    phases); not a regression
  - `validate:paynow`/`validate:stripe` not run for the same reason (no configured
    environment); nothing in this phase touches Paynow or Stripe config
  - `npm run build` intentionally not run, per this phase's explicit instruction

## Existing Payload Status

Completely untouched. `payload.init()` still runs by default
(`USE_NATIVE_SERVER` unset/false); `/admin`, `src/payload/**`, and every Payload
collection/hook/plugin are unmodified.

## Existing Stripe Status

Completely untouched. `@payloadcms/plugin-stripe`, `create-payment-intent.ts`, and the
storefront Stripe Elements flow are unmodified and remain the default checkout path
(`USE_PAYNOW_CHECKOUT=false`).

## Existing Auth/Admin Status

Behaviorally unchanged by default. With `USE_NATIVE_AUTH`/`USE_NATIVE_ADMIN` unset,
`getMeUser`/`getMe`/`getAuthenticatedPayloadUser` take the exact same Payload-backed
branch as before, and `AdminBar` renders exactly as before. The frontend's login/logout/
session UX (`AuthProvider`) is unmodified in every case, flag or no flag.

## Remaining Blockers

Ordered roughly by how much further work each implies:

1. **`/admin` and `src/payload/**` are entirely untouched** — still the only admin UI,
   still ~90 files of collections/access/hooks/plugins. Not in scope for this phase; still
   the largest remaining removal blocker.
2. **The frontend never issues a native session.** `AuthProvider`
   (`src/app/_providers/Auth/index.tsx`) still calls only Payload's `/api/users/*` and sets
   only the `payload-token` cookie. Until a separately-approved phase switches it to call
   `/api/auth-native/*`, the now-correct native-auth branches in `getMeUser`/`getMe`/
   `getAuthenticatedPayloadUser`/the paywall route have no real browser traffic reaching
   them — they're exercised by tests and by direct API calls only.
3. **`USE_NATIVE_SERVER=true` is only safe today paired with
   `USE_NATIVE_REPOSITORY=true`** — see "Server Bootstrap Changes." Not a defect, just a
   real ordering dependency worth remembering when someone actually flips these flags in
   an environment.
4. **Stripe's checkout path still lives inside `src/payload/**`** (unchanged from Phase
   13's finding) — removing Payload still can't happen independently of resolving Stripe,
   regardless of how many native flags are on.
5. **`src/server.default.ts`/`src/server.prod.ts`** (alternate eject/prod builds) were not
   decoupled from Payload — only `src/server.ts` was, matching this phase's task list.
   Worth a small follow-up if either build path is actually used.

## Recommended Next Phase

Given the size of what's left (item 1 above, `/admin` + `src/payload/**`, is substantial
on its own, and item 2 requires care around session-issuing UX changes), recommend
splitting rather than attempting a single next phase:

**Phase 13b — Wire the frontend to native auth (approval needed for auth UX change):**
Switch `AuthProvider` to call `/api/auth-native/*` when `USE_NATIVE_AUTH=true`, issuing
`native-session` instead of relying on Payload's cookie. This is explicitly an auth UX
change (unlike everything in this phase), so it needs its own approval rather than being
bundled here. Once done, `USE_NATIVE_AUTH=true` would be end-to-end testable with real
browser traffic for the first time.

Do **not** proceed to Payload removal, Stripe removal, or production cutover yet — per
the stop condition below.

## Existing Storefront status (carried over, unaffected by this phase's changes)

Default (flag-off) behavior unchanged — still served by Payload's GraphQL API.
`USE_NATIVE_REPOSITORY=true` now additionally covers `PaywallBlocks`' data (new in this
phase) on top of the category/product/page reads Phases 2–4 already covered.

---

**STOPPING per the Phase 13a stop condition.** Payload was not removed. Stripe was not
touched. No production cutover work was started. Waiting for explicit approval before any
of: actual Payload removal, Stripe removal, production cutover, or the recommended
Phase 13b (frontend native-auth wiring).
