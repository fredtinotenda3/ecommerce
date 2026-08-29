# Phase 11 — Parallel Validation

**Status: validation tooling/documentation only.** This document does not
authorize a production cutover. It exists so the old (Payload/Stripe) and
new (native/Paynow) stacks can be verified side-by-side, with every flag
defaulting to "old behavior," before any cutover phase is even proposed.

All four flags below default to unset/false. With every flag unset, this
application is byte-for-byte the same app it was before Phase 2 — no new
route, page, or read path is reachable.

## Flags

| Flag | Introduced | Helper | Default | Gates |
|---|---|---|---|---|
| `USE_NATIVE_REPOSITORY` | Phase 2 | `src/app/_api/dataSource.ts` → `isNativeRepositoryEnabled()` | off | Native repository reads for categories/products/pages (storefront) |
| `USE_NATIVE_AUTH` | Phase 5 | `src/app/_api/authFlag.ts` → `isNativeAuthEnabled()` | off | `/api/auth-native/*` routes |
| `USE_NATIVE_ADMIN` | Phase 6 | `src/app/_api/adminFlag.ts` → `isNativeAdminEnabled()` | off | `/native-admin/*` route group (also requires `USE_NATIVE_AUTH=true` + an authorized admin session — see `src/app/_api/adminAccess.ts`) |
| `USE_PAYNOW_CHECKOUT` | Phase 8 | `src/app/_api/paynowCheckoutFlag.ts` → `isPaynowCheckoutEnabled()` | off | Checkout page's payment flow, plus `/api/checkout/paynow/*` and `/api/payments/paynow/*` |

All four flags are read independently — any combination on/off is a valid
deployment configuration. None of them affects the others' code paths: the
native reads, native auth, native admin, and Paynow checkout modules do
not import or call into each other's implementation to decide what to do;
each checks only its own flag. `USE_NATIVE_ADMIN` is the one exception,
in that native admin access *also* requires `USE_NATIVE_AUTH=true` at
runtime — this is a deliberate additional runtime check in
`getNativeAdminAccess()`, not a coupling between the flag helpers
themselves.

Run `npm run validate:flags` at any time to print the live value and
effective state of all four flags in the current environment (read-only,
no DB/network access — see `scripts/validation/checkFlags.ts`).

## Validation matrix

| # | Behavior to confirm | Flag state | How to verify | Automated? |
|---|---|---|---|---|
| 1 | Old Stripe checkout still works | `USE_PAYNOW_CHECKOUT` unset/false | Load `/checkout` with items in cart → Stripe Elements form renders, `/api/create-payment-intent` (Payload endpoint) is called | Manual (needs live Stripe test key) + `tests/paymentService.test.ts`, `tests/pricing.test.ts` for the pricing logic underneath it |
| 2 | New Paynow checkout activates only when flagged on | `USE_PAYNOW_CHECKOUT=true` | Load `/checkout` → Paynow button renders instead of Stripe Elements; with the flag off, `/api/checkout/paynow/initiate` returns 404 | `tests/paynowCheckoutFlag.test.ts` (404 guard), `tests/paynowCheckoutService.test.ts`, `tests/paynowCallbackService.test.ts` (incl. idempotency), `tests/paynowSignature.test.ts`, `tests/paynowConfig.test.ts` |
| 3 | Native repository paths activate only when flagged on | `USE_NATIVE_REPOSITORY=true` | Compare storefront category/product/page output with the flag on vs. off — content must match Payload's | `tests/dataSource.test.ts`, `tests/fetchCategoriesNative.test.ts`, `tests/fetchProductNative.test.ts`, `tests/fetchPageNative.test.ts`, `tests/categoryStorefrontAdapter.test.ts`, `tests/productStorefrontAdapter.test.ts`, `tests/pageStorefrontAdapter.test.ts`, `tests/layoutRelationsAdapter.test.ts` |
| 4 | Native auth endpoints hidden behind their flag | `USE_NATIVE_AUTH` unset/false → all `/api/auth-native/*` return 404 | `curl` each of the six routes with the flag off; repeat with it on | `tests/authFlag.test.ts` (new), `tests/AuthService.test.ts`, `tests/auth.test.ts`, `tests/payloadCompatiblePassword.test.ts` |
| 5 | Native admin hidden behind its flag + requires admin session | `USE_NATIVE_ADMIN` unset/false, or on but unauthenticated/non-admin → `/native-admin/*` returns 404 | Visit `/native-admin` in three states: flag off; flag on + no session; flag on + non-admin session; flag on + admin session | `tests/adminFlag.test.ts`, `tests/AdminAccessService.test.ts` (denies on either flag off, denies non-admin, allows admin) |
| 6 | Stripe and Paynow code coexist without cross-importing in the wrong flag state | static — always true | `grep` check (below) confirms no import cycle between the two payment modules | Static check (below); `tests/PaynowProvider.test.ts` exercises the Paynow provider in total isolation from Stripe |
| 7 | Data migration scripts are dry-run safe and idempotent | n/a (scripts, not runtime flags) | Run each `npm run migration:*` script with no args (dry run) against a scratch DB; run twice and diff the two reports | `tests/migrations/legacyStripeIdBackfill.test.ts`, `tests/migrations/orderBackfill.test.ts`, `tests/migrations/paymentBackfill.test.ts` |
| 8 | Existing GraphQL/Payload path returns correct data when native flags are off | `USE_NATIVE_REPOSITORY` unset/false | Query `/api/graphql` directly for a category/product/page and compare to storefront rendering | Pre-existing Payload/GraphQL behavior, unmodified by any native-path phase — no new test needed; regression would show up in `tests/*StorefrontAdapter.test.ts` fixtures diverging from real shapes |
| 9 | Existing Payload Admin still works | n/a — Payload admin is untouched by every native/Paynow phase | Log into `/admin`, browse Products/Orders/Users/Pages, edit a document | Manual only — no phase has ever modified `src/payload/**` collections/hooks/globals |
| 10 | Native admin is read-only and never exposes password/auth-internal fields | `USE_NATIVE_ADMIN=true` + admin session | Inspect every `/native-admin/*` page/response for `hash`, `salt`, `resetPasswordToken`, `loginAttempts`, `lockUntil` | `tests/AdminQueryService.test.ts` (explicit `not.toContain` assertions for all of the above, on both product and customer detail) |

## New tests added in Phase 11

Two flag helpers had no dedicated unit test even though their siblings
(`dataSource.test.ts`, `adminFlag.test.ts`) did. Added for parity and
because they gate the same "look like a 404" contract:

- `tests/authFlag.test.ts` — `isNativeAuthEnabled()`: unset → false,
  non-`"true"` strings → false, `"true"` → true.
- `tests/paynowCheckoutFlag.test.ts` — `isPaynowCheckoutEnabled()` (same
  cases) **and** `guardPaynowCheckoutEnabled()`: returns a 404
  `{ error: 'Not found' }` response when off, `null` (proceed) when on.

No other automated test gaps were found in the ten scope items above —
the existing 250-test suite already covers server-authoritative pricing
(`tests/pricing.test.ts`), Paynow callback idempotency
(`tests/paynowCallbackService.test.ts`), native-admin field redaction
(`tests/AdminQueryService.test.ts`), and dual-flag admin authorization
(`tests/AdminAccessService.test.ts`) directly.

## Static cross-import check (item 6)

Run this to confirm the Stripe (Payload plugin + `create-payment-intent`
endpoint) and Paynow (`src/lib/paynow/**`, `/api/checkout/paynow/*`,
`/api/payments/paynow/*`) modules never import each other:

```bash
# Paynow code must never import Stripe
grep -rl "stripe" src/lib/paynow src/app/api/checkout/paynow src/app/api/payments/paynow 2>/dev/null

# The Stripe endpoint must never import Paynow
grep -rl "paynow" src/payload/endpoints/create-payment-intent.ts 2>/dev/null
```

Both should return no matches. This was run as part of this phase's
implementation and returned empty for both.

## Manual smoke-test checklist

Run through this with each flag combination that will actually be used in
staging (at minimum: all-off, and all-on). Nothing here requires live
Paynow or Stripe credentials except where noted.

- [ ] **Storefront homepage** loads, layout/header/footer render
- [ ] **Product listing** page loads, pagination/filtering works
- [ ] **Product detail** page loads, price/images/description correct
- [ ] **CMS page** (any Payload `Page` doc) renders its blocks correctly
- [ ] **Cart** — add/remove/update quantity, totals recalculate
- [ ] **Checkout page, `USE_PAYNOW_CHECKOUT=false`** — Stripe Elements
      form renders (requires a Stripe test key to fully exercise payment)
- [ ] **Checkout page, `USE_PAYNOW_CHECKOUT=true`** — Paynow button
      renders instead of Stripe Elements (requires Paynow test
      credentials to fully exercise payment; button rendering and the
      absence of a PaymentIntent call can be verified without them)
- [ ] **Login/account pages** — existing Payload-backed login still
      works regardless of `USE_NATIVE_AUTH`; with `USE_NATIVE_AUTH=true`,
      `/api/auth-native/login` additionally responds (not yet wired into
      any UI, so this is an API-level check via `curl`/Postman)
- [ ] **Payload admin** (`/admin`) — login, browse and edit a document in
      each collection touched by any phase (Products, Orders, Users)
- [ ] **Native admin** (`/native-admin`, if `USE_NATIVE_ADMIN=true` and an
      admin session is available) — browse Products/Categories/Orders/
      Customers/Pages/Media lists and one detail page each; confirm no
      edit controls are present (read-only) and no password/auth-internal
      fields are visible anywhere
- [ ] **Migration dry-run reports** — run each `npm run migration:*`
      script with no flags (dry run) against a staging/scratch database;
      confirm the printed + JSON report (`scripts/migrations/reports/`)
      shows the expected `migrated`/`skipped`/`errors` counts and that no
      write occurred (re-run and diff the two reports — they should
      report identically for anything already "migrated")

## Toggling flags in staging

Copy `.env.example` to `.env` and set any subset of the four flags to the
exact string `true` (any other value, including unset, is treated as
off — see the flag helper doc comments). For a quick read of what's
currently active without starting the app:

```bash
npm run validate:flags
```

Because every route/path gated by these flags returns a 404 when off
(never a redirect, 401, or 403), toggling a flag off in an emergency
makes the corresponding surface disappear immediately — no additional
cleanup step is required to "hide" it.

## Known gaps / risks

- **Live-credential paths are manual-only.** Nothing in the automated
  suite calls live Stripe or Paynow APIs (by design — task 6 of this
  phase explicitly forbids it), so end-to-end payment completion (item 1
  and the credentialed half of item 2 above) has only ever been verified
  manually / via each provider's own test-mode tooling outside this repo.
- **GraphQL/Payload parity (item 8) has no automated diff test.** The
  native storefront adapters are tested against their own fixtures, but
  there's no test that runs the same request through both paths and
  diffs the output. Worth adding in a later phase if native reads are
  ever the intended default.
- **No automated test drives an actual `/native-admin/*` HTTP request**
  end-to-end (the layout's `notFound()` gating and `AdminAccessService`
  are tested separately, not the composed route). A Next.js route/
  integration test harness isn't set up in this repo yet.
- **`.env.example` previously didn't list any of the four flags.** Fixed
  in this phase, but any existing `.env` files created before this phase
  won't have them — unset is equivalent to `false` either way, so this
  is a discoverability gap, not a behavior risk.

## Go/No-Go criteria for Phase 12 (cutover)

This phase makes no recommendation to proceed with cutover. Before that
conversation starts, at minimum:

1. Every item in the validation matrix above has been manually verified
   in staging with the target flag combination, including at least one
   full live-credential payment on both Stripe and Paynow.
2. The GraphQL/Payload-vs-native parity gap (see Known Gaps) is closed
   with an explicit diff test, or the decision to proceed without one is
   made consciously and recorded.
3. A rollback plan exists that is *just* "flip the flag back off" — this
   phase found no evidence that's untrue today, but it should be
   re-verified against whatever the actual Phase 12 change set turns out
   to be, since this document only covers the state of the repository as
   of Phase 11.
4. `npm run lint`, `npx tsc --noEmit` (0 new errors beyond the one
   pre-existing, documented `ArchiveBlock` error), and `npm run test` all
   pass on the exact commit proposed for cutover.

Per the Phase 11 task instructions, production cutover, Stripe removal,
and Payload removal all require explicit approval and are out of scope
for this phase regardless of how the above criteria look.
