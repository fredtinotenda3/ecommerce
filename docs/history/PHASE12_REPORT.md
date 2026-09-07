# PHASE 12 IMPLEMENTATION REPORT

## Cutover Stages

Seven reversible stages, documented in full in
`docs/production-cutover-runbook.md`:

- **A** — Deploy current code with all four flags off (no behavior change).
- **B** — Migration dry-runs against a production *copy*.
- **C** — Migrations with `--apply`, after a confirmed backup.
- **D** — `USE_NATIVE_REPOSITORY=true` (staging, then production).
- **E** — `USE_NATIVE_AUTH=true` (Payload auth kept live as fallback throughout).
- **F** — `USE_PAYNOW_CHECKOUT=true` (highest-risk stage; requires validated Paynow credentials and a completed test-mode payment first).
- **G** — `USE_NATIVE_ADMIN=true` (off until admin staff are trained; requires `USE_NATIVE_AUTH=true`).

Each stage has its own env var change, expected user-visible effect,
smoke tests, monitoring checks, and rollback step in the runbook.

## Rollback Plan

Every stage D–G rolls back with a single env var flip (`...=false`) plus
a restart/redeploy — no code change, no data undo. Stage C's rollback is
a restore from the pre-migration backup, though this should not be
needed since every migration script is additive and idempotent (dry-run
by default, `--apply` required to write, re-run-safe). Stage A/B involve
no writes. Full summary table and an incident-response section (Paynow
callback loss, native DB connection pool exhaustion, etc.) are in
`docs/production-cutover-runbook.md` §7–9.

## Monitoring Checks

Documented in the runbook §5: error/5xx rate and response time
segmented by route, database connection pool health (two Mongoose
connections now share one DB), payment success/failure split by
provider, Paynow callback delivery, native auth error rate, and
`/native-admin/*` access patterns. §4 lists which `npm run validate:*`
script to re-run after each stage as a fast automated check.

## Required Environment Variables

No new environment variables were introduced. Phase 12 documents and
validates the existing set:

- `USE_NATIVE_REPOSITORY`, `USE_NATIVE_AUTH`, `USE_NATIVE_ADMIN`, `USE_PAYNOW_CHECKOUT`
- `DATABASE_URI`
- `PAYNOW_INTEGRATION_ID`, `PAYNOW_INTEGRATION_KEY`, `PAYNOW_RESULT_URL`, `PAYNOW_RETURN_URL`, `PAYNOW_MODE`
- `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOKS_SIGNING_SECRET`, `PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY`

## Files Created

- `scripts/validation/checkDatabaseConnectivity.ts` — read-only check that the native Mongo connection (`src/lib/db/connection.ts`) can reach and read the target database; prints collection list and approximate counts; never writes.
- `scripts/validation/checkPaynowConfig.ts` — read-only check that `loadPaynowConfig()` succeeds; reports mode (test/live) and presence of result/return URLs; never prints the integration key, never calls Paynow's API.
- `scripts/validation/checkStripeConfig.ts` — read-only check that the existing Stripe rollback path (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOKS_SIGNING_SECRET`) is present and internally consistent (test/live key match); secrets are masked, never printed in full.
- `docs/production-cutover-runbook.md` — the full runbook: pre-cutover checklist, backup requirements, migration run order, seven-stage flag activation sequence, smoke tests, monitoring checks, data safety checks, rollback plan, go/no-go criteria, and incident response notes.

## Files Modified

- `package.json` — added three npm scripts (`validate:db`, `validate:paynow`, `validate:stripe`) alongside the existing `validate:flags`. No dependency changes.

## Files Deleted

None.

## New Dependencies

None. All three new scripts use only packages already in `package.json` (`dotenv`, plus the app's own `src/lib/db/connection.ts` and `src/lib/payments/paynow/paynowConfig.ts` modules).

## Validation Results

- **lint** (`npm run lint`): 0 errors.
- **typecheck** (`npx tsc --noEmit`): only the same 1 pre-existing error in `src/app/_blocks/ArchiveBlock/index.tsx` (unrelated, present before this phase). No new errors from Phase 12 files.
- **tests** (`npm run test`): 258/258 passing (unchanged from the pre-Phase-12 baseline — no new test files were added, since the three scripts are thin, side-effect-reporting wrappers around already-tested modules: `loadPaynowConfig` has its own coverage in `tests/paynowConfig.test.ts`, and `getDbConnection`/`closeDbConnection` are exercised indirectly throughout the migration test suite).

All three new scripts were also manually smoke-tested directly (not just type-checked): each correctly exits `1` with a clear message when its required env vars are absent, and exits `0` with correctly masked/redacted output when given sample credentials.

## Existing Stripe Status

Untouched. `@payloadcms/plugin-stripe`, `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js` remain in `package.json`; `src/payload/endpoints/create-payment-intent.ts`, the Stripe webhook handling, and the storefront's Stripe Elements checkout form are unmodified. `USE_PAYNOW_CHECKOUT=false` (the default) means Stripe is still the live, only checkout path today.

## Existing Payload Status

Untouched. `payload.config.ts`, all collections/hooks/globals/endpoints under `src/payload/**`, and `/admin` are unmodified. `src/server.ts` still calls `payload.init()` and mounts Next.js on the same Express app exactly as before.

## Remaining Risks

- **No automated end-to-end diff test between the Payload/GraphQL and native read paths** (carried over from the Phase 11 report's own "known gaps" — still true; recommended before Stage D if not already closed by a later phase).
- **Backup/restore procedure is described but not automated.** The runbook tells an operator what to do (Atlas snapshot or `mongodump`) but Phase 12 intentionally does not add a scripted backup tool, since a correct one depends on the actual hosting platform (Atlas vs. self-hosted) and getting it wrong is riskier than a well-documented manual step.
- **`checkDatabaseConnectivity.ts` opens a real connection to whatever `DATABASE_URI` is set to.** It is read-only by design, but running it against production requires the same network access/allow-listing any other read-only tool would — this is a deployment/infra concern, not a code gap, but worth calling out before an operator runs it from an unexpected host.
- **The `.env.example` file in this repository contains what appears to be a real, non-placeholder MongoDB Atlas connection string with embedded credentials** (predates this phase; not modified by Phase 12). This is a pre-existing exposure worth flagging to the team independently of the cutover — Phase 12 did not touch or reproduce it beyond what was already in the repository.
- **Stage F (Paynow checkout) is the one stage with real payment risk** and depends on Paynow support/tooling this repository cannot verify (e.g., confirming an integration ID/key pair has actually been "set live" by Paynow) — flagged explicitly in the runbook's Stage F section and go/no-go criteria.

## Recommended Next Steps

1. Have a human operator work through the pre-cutover checklist (`docs/production-cutover-runbook.md` §0) in staging first, end to end, before scheduling a production window.
2. Rotate the credentials currently sitting in `.env.example` (see Remaining Risks) independently of this cutover — Phase 12 flagged it but did not act on it, per the phase's scope (no destructive/irreversible changes).
3. Confirm backup/restore has actually been tested at least once against the real hosting platform before Stage C is scheduled.
4. Proceed stage by stage (A → G) per the runbook, re-running `npm run validate:flags/db/stripe/paynow` at each checkpoint, and do not advance past a stage until its go/no-go criteria (§8) are met.
5. **Do not remove Payload or Stripe.** Per the stop condition, that requires separate, explicit approval and is out of scope for this phase.
