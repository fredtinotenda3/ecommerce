# PHASE 11 IMPLEMENTATION REPORT

## Validation Matrix/Checklist

Created `docs/parallel-validation.md`, containing:

- A flag reference table (`USE_NATIVE_REPOSITORY`, `USE_NATIVE_AUTH`,
  `USE_NATIVE_ADMIN`, `USE_PAYNOW_CHECKOUT`) — introducing phase, helper
  location, default, and what each gates.
- A 10-row validation matrix mapping each of the Phase 11 scope items to:
  flag state to test, how to verify manually, and which automated test(s)
  already cover it.
- A static cross-import check (two `grep` commands) proving Paynow code
  never imports Stripe and vice versa — run and confirmed clean (both
  return empty).
- A manual smoke-test checklist covering all 11 surfaces requested
  (homepage, listing, product detail, CMS page, cart, checkout×2 flag
  states, login/account, Payload admin, native admin, migration dry-run
  reports).
- A "toggling flags in staging" section pointing at the new
  `npm run validate:flags` helper and `.env.example`.
- Known gaps/risks and go/no-go criteria for Phase 12 (see below).

## New Tests/Scripts Added

**Tests** (both follow the existing `dataSource.test.ts`/`adminFlag.test.ts`
pattern exactly — env-var save/restore in `afterEach`, same three cases):

- `tests/authFlag.test.ts` (3 tests) — `isNativeAuthEnabled()`: unset →
  false; non-`"true"` strings (`"1"`, `"True"`, `"yes"`) → false; exact
  `"true"` → true. This flag helper existed since Phase 5 but, unlike its
  siblings, had no dedicated unit test.
- `tests/paynowCheckoutFlag.test.ts` (5 tests) — `isPaynowCheckoutEnabled()`
  (same three cases) **plus** `guardPaynowCheckoutEnabled()`: confirms it
  returns a 404 JSON `{ error: 'Not found' }` response when the flag is
  off, and `null` (proceed) when on. This directly proves the "hidden
  routes return 404 when disabled" requirement (scope item 3) at the unit
  level, for every `/api/checkout/paynow/*` and `/api/payments/paynow/*`
  route that calls this guard.

**Script:**

- `scripts/validation/checkFlags.ts` — zero-dependency (no DB, no
  network, no Payload/Mongoose import) read-only helper that prints the
  live value and effective on/off state of all four flags, using the
  app's own flag helpers so its output can never drift from actual
  runtime behavior. Wired up as `npm run validate:flags`. Manually
  verified with flags unset (all report OFF) and with two flags set to
  `"true"` (both report ON, others OFF).

No new dependency was required for either the tests or the script — both
use only what vitest/ts-node/Next already provide.

## Flag Behavior Verified

All four flags confirmed to default to off/unset and to be read
independently of one another (no flag helper's logic branches on another
flag), with one intentional runtime exception: `getNativeAdminAccess()`
additionally requires `USE_NATIVE_AUTH=true` before authorizing native
admin access — that's a deliberate cross-check already covered by
`tests/AdminAccessService.test.ts`, not something this phase changed.

- `USE_NATIVE_REPOSITORY` off → storefront reads use the existing
  Payload GraphQL path (unchanged; not touched this phase).
- `USE_NATIVE_AUTH` off → all six `/api/auth-native/*` routes 404
  (verified via existing `guardNativeAuthEnabled()` + new
  `authFlag.test.ts`).
- `USE_NATIVE_ADMIN` off, or on without an authorized admin session →
  `/native-admin/*` 404s (existing `AdminAccessService.test.ts`,
  `adminFlag.test.ts`).
- `USE_PAYNOW_CHECKOUT` off → Paynow routes 404, Stripe checkout is the
  only active path (new `paynowCheckoutFlag.test.ts` + existing
  `paynowCheckoutService.test.ts`/`paynowCallbackService.test.ts`).

## Existing Stripe Status

Untouched. `src/payload/endpoints/create-payment-intent.ts` and the
`@payloadcms/plugin-stripe` config were not modified, inspected only to
confirm the cross-import check. Stripe checkout remains the only active
path when `USE_PAYNOW_CHECKOUT` is off.

## Existing Paynow Status

Untouched (Phases 7–9 implementation not modified). Confirmed via the
static cross-import check that no file under `src/lib/paynow/**`,
`src/app/api/checkout/paynow/**`, or `src/app/api/payments/paynow/**`
references Stripe.

## Existing Payload/GraphQL Status

Untouched. No file under `src/payload/**` was created, modified, or
inspected for anything beyond the one grep check above.

## Existing Auth/Admin Status

Untouched. Payload's own `/api/users/*` auth and `/admin` dashboard are
unaffected by any native-auth/native-admin flag state, as already
documented in the Phase 5/6 code comments and re-confirmed in this
phase's validation matrix.

## Files Created

- `tests/authFlag.test.ts`
- `tests/paynowCheckoutFlag.test.ts`
- `scripts/validation/checkFlags.ts`
- `docs/parallel-validation.md`

## Files Modified

- `package.json` — added one script: `"validate:flags": "ts-node -T scripts/validation/checkFlags.ts"`
- `.env.example` — added the four flag variables (all defaulted to `false`) with an explanatory comment block

## Files Deleted

None.

## New Dependencies

None.

## Validation Results

- **lint** (`npm run lint`): 0 errors — unchanged from baseline.
- **typecheck** (`npx tsc --noEmit`): 1 error, the same pre-existing
  `src/app/_blocks/ArchiveBlock/index.tsx` error documented in the task
  brief. No new errors introduced.
- **tests** (`npm run test`): **258 tests passing** across **31 test
  files** (up from the documented baseline of 250 tests / 29 files — the
  8 new tests are the two files listed above; every pre-existing test
  still passes unchanged).

`npm run build` was not run, per instructions. No live Paynow or Stripe
API was contacted.

## Remaining Risks

- **Live-credential payment flows remain manual-only.** No automated
  test calls live Stripe or Paynow APIs (by design, per this phase's
  constraints), so full end-to-end payment completion on both providers
  has not been exercised by anything created in this phase.
- **No automated GraphQL-vs-native-repository parity/diff test exists.**
  Each path is tested against its own fixtures; nothing runs the same
  request through both and asserts the outputs match. Flagged as a gap
  in the validation doc, not fixed in this phase (would require deciding
  on a shared fixture/test-DB strategy, which is more than "lightweight
  tooling").
- **No end-to-end HTTP-level test for `/native-admin/*`.** The layout's
  `notFound()` gate and `AdminAccessService.resolveAdminAccess()` are
  each unit-tested, but nothing drives an actual composed Next.js
  request through the route group. This repo has no route/integration
  test harness set up for that yet.
- **Pre-Phase-11 `.env` files won't list the four flags** even though
  `.env.example` now does — not a behavior risk (unset already equals
  off) but worth calling out so staging owners know to check
  `npm run validate:flags` rather than assuming an old `.env` is
  exhaustive.

## Go/No-Go Criteria for Phase 12

Not recommending cutover in this phase. Before that conversation starts:

1. Every row of the validation matrix has been manually verified in
   staging under the target flag combination, including at least one
   full live-credential payment through both Stripe and Paynow.
2. The GraphQL/native parity gap is either closed with an explicit diff
   test or the decision to proceed without one is made consciously and
   recorded.
3. Confirm the rollback plan is genuinely "flip the flag back to off" —
   true as of this phase's code, but must be re-verified against
   whatever Phase 12's actual change set turns out to be.
4. `npm run lint`, `npx tsc --noEmit` (no new errors beyond the one
   pre-existing, documented one), and `npm run test` all pass on the
   exact commit proposed for cutover.

Per the task's stop condition: no production cutover, Stripe removal, or
Payload removal was performed or started in this phase, and none should
begin without explicit approval.
