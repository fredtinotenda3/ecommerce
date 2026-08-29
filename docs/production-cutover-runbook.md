# Production Cutover Runbook

**Status: planning/tooling document only.** Nothing in this file, and
nothing run as part of Phase 12, triggers a production deployment or
flips a production flag. This is what a human operator follows when
they decide to execute the cutover.

This runbook governs moving the live storefront from the current
Payload + Stripe stack to the native + Paynow stack, using the four
existing feature flags:

- `USE_NATIVE_REPOSITORY`
- `USE_NATIVE_AUTH`
- `USE_NATIVE_ADMIN`
- `USE_PAYNOW_CHECKOUT`

Payload and Stripe are **not removed** at any stage in this document.
Every stage below is reversible by an env var change alone — no code
change, no data deletion, no schema change. See
[`docs/parallel-validation.md`](./parallel-validation.md) for the full
flag reference and the automated/manual test matrix each stage draws on.

---

## 0. Pre-cutover checklist

Complete every item before touching a production flag.

- [ ] `npm run lint` passes with 0 errors on the commit being deployed
- [ ] `npx tsc --noEmit` shows no *new* errors (the one pre-existing
      error in `src/app/_blocks/ArchiveBlock/index.tsx` is a known,
      unrelated issue — confirm no others have appeared)
- [ ] `npm run test` — full suite passing
- [ ] `npm run validate:flags` run against the **staging** environment,
      output reviewed and attached to the change record
- [ ] `npm run validate:db` run against the **production database (or a
      current copy of it)** — confirms native connection module can
      reach and read the database before any native path is enabled
- [ ] `npm run validate:stripe` run against **production** env vars —
      confirms the rollback target (Stripe) is itself healthy *before*
      you start, not just after something goes wrong
- [ ] `npm run validate:paynow` run against **production** Paynow
      credentials — confirms `USE_PAYNOW_CHECKOUT` will not immediately
      throw `PaynowConfigError` when enabled
- [ ] A recent database backup/snapshot exists and its restore procedure
      has been confirmed (see §1)
- [ ] All items in the "Manual smoke-test checklist" of
      `docs/parallel-validation.md` have been run at least once in
      staging with the target flag combination
- [ ] On-call/rollback owner identified and available for the entire
      cutover window
- [ ] Change window communicated to anyone who needs to know (support
      staff, admin users, etc.)

---

## 1. Backup requirements

The application uses a single MongoDB database (`DATABASE_URI`), shared
by Payload's connection and the native `src/lib/db/connection.ts`
connection — both point at the same physical database (see the header
comment in `connection.ts`). Every stage below reads from and/or
additively writes to this one database, so it is the only thing that
needs a backup.

Before **any** stage that involves running a migration script with
`--apply`, or enabling `USE_NATIVE_REPOSITORY`/`USE_PAYNOW_CHECKOUT` in
production for the first time:

1. Take a full database backup or point-in-time snapshot.
   - If the database is hosted on MongoDB Atlas (the connection string
     format in `.env.example` is an Atlas SRV-style URI), use Atlas's
     built-in snapshot feature — it is continuous and requires no
     application downtime.
   - If self-hosted, use `mongodump --uri="$DATABASE_URI" --out=<path>`
     from a host that is allow-listed for DB access. Do **not** run this
     from inside the application repo or commit its output.
2. Record the backup's timestamp/identifier in the change record for
   this cutover.
3. Confirm (do not assume) that a restore from this backup has been
   tested previously, or perform a test restore into a scratch
   database. A backup that has never been restored is unverified.
4. Only after the backup is confirmed, proceed to migrations or flag
   changes that write data.

None of the migration scripts in `scripts/migrations/*` are destructive
(they only add new fields — see each script's header comment), but the
backup requirement is unconditional regardless: it is the rollback path
for anything not covered by an env var flip (see §7, Rollback Plan).

---

## 2. Migration run order

Run every migration script as a **dry run first** (the default — no
`--apply` flag), inspect its printed report and the JSON report written
to `scripts/migrations/reports/`, and only then re-run with `--apply`.

Order matters where one script's output is consumed by another's
assumptions; run in this sequence:

1. `npm run migration:products:legacy-stripe-id` — preserves the
   Stripe price/product linkage on Product documents before anything
   else touches pricing.
2. `npm run migration:products:prices` — backfills the native price
   field on Product documents (the fix for the "no native price field"
   gap noted in `MIGRATION-AUDIT.md`).
3. `npm run migration:users:legacy-stripe-id` — preserves the Stripe
   customer linkage on User documents.
4. `npm run migration:orders:backfill` — backfills native order fields
   (`orderNumber`, `status`, `subtotal`, `currency`, item snapshots).
5. `npm run migration:payments:backfill-historical-stripe` — backfills
   historical Stripe payment records into the native payments
   collection, for order history continuity after Paynow is live.

For each script:

```bash
# 1. Dry run — read-only, writes a report, changes nothing
npm run migration:<name>

# 2. Inspect the printed summary AND the JSON file it wrote under
#    scripts/migrations/reports/ — confirm the migrated/skipped/errors
#    counts look right for the current database size

# 3. Only if the dry run looks correct, apply
npm run migration:<name> -- --apply

# 4. Re-run the dry run once more — every record should now report as
#    "skipped" (already migrated), confirming idempotency
npm run migration:<name>
```

Do not proceed to the next script in the sequence until the current
one's apply run and idempotency re-check both look correct.

---

## 3. Flag activation sequence

Each stage is independent and reversible on its own (see
`docs/parallel-validation.md` — the flags do not depend on each other
except `USE_NATIVE_ADMIN`, which additionally requires
`USE_NATIVE_AUTH=true` at runtime). Follow this order because it moves
from lowest-risk/read-only to highest-risk/payment-affecting:

### Stage A — Deploy with all flags off

- **Env var changes:** none beyond what's already in production
  (`USE_NATIVE_REPOSITORY`, `USE_NATIVE_AUTH`, `USE_NATIVE_ADMIN`,
  `USE_PAYNOW_CHECKOUT` all unset or `false`).
- **User-visible effect:** none. Byte-for-byte the same behavior as
  before this deploy.
- **Purpose:** get the Phase 2–11 code onto production infrastructure
  and confirm the deploy itself is healthy before any flag is touched.
- **Smoke test:** homepage, product listing, product detail, cart,
  Stripe checkout, `/admin` login — all exactly as before.
- **Rollback:** redeploy the previous release if the deploy itself is
  unhealthy. No flag rollback needed since nothing changed behaviorally.

### Stage B — Migration dry-runs against a production copy

- Run every script in §2 in dry-run mode against a **copy** of
  production data (not production itself), to get real counts and spot
  any unexpected data shapes before touching real data.
- **Rollback:** none needed — dry runs never write.

### Stage C — Migrations with `--apply`, after backup

- Complete §1 (backup) first.
- Run every script in §2 in order, dry run → apply → idempotency
  re-check, against **production**.
- **User-visible effect:** none. These scripts only add new,
  previously-absent fields; nothing reads them yet because
  `USE_NATIVE_REPOSITORY`/`USE_PAYNOW_CHECKOUT` are still off.
- **Rollback:** restore from the §1 backup. (In practice this should
  not be needed — the scripts are additive and idempotent — but the
  backup is the rollback path of last resort for this stage
  specifically, since there is no flag to flip back.)

### Stage D — `USE_NATIVE_REPOSITORY=true` in staging, then production

- **Env var change:** `USE_NATIVE_REPOSITORY=true`.
- **User-visible effect:** storefront category/product/page reads are
  served from the native repository instead of Payload's GraphQL API.
  Content should be pixel-for-pixel identical — any visible difference
  is a bug.
- **Sequence:** staging first, run the full manual smoke-test checklist
  from `docs/parallel-validation.md`, compare native-on vs native-off
  output side by side. Only after that passes, repeat in production.
- **Monitoring:** watch error rates on storefront routes, p95/p99
  response time for category/product/page routes (native path adds a
  second Mongo connection query pattern — watch for connection pool
  exhaustion), and 5xx rate.
- **Rollback:** set `USE_NATIVE_REPOSITORY=false` (or unset) and
  redeploy/restart. Reads immediately revert to the Payload GraphQL
  path. No data changes to undo.

### Stage E — `USE_NATIVE_AUTH=true`, Payload auth kept as fallback

- **Env var change:** `USE_NATIVE_AUTH=true`.
- **User-visible effect:** `/api/auth-native/*` routes become live
  (issue native-session cookies). Payload's existing `/api/users/*`
  auth is untouched and keeps working regardless — the storefront's
  login UI does not call the native routes yet (see
  `docs/parallel-validation.md`), so this stage is intentionally
  low-visibility. Its purpose is to validate the native auth routes
  under real infrastructure before any UI is switched to depend on
  them.
- **Monitoring:** `curl` each of the six native auth routes on a
  schedule (or via existing uptime tooling) to confirm 200s where
  expected; watch for unexpected spikes in calls to these routes if
  nothing should be calling them yet.
- **Rollback:** set `USE_NATIVE_AUTH=false`. Native auth routes return
  404 again; Payload login is unaffected throughout.

### Stage F — `USE_PAYNOW_CHECKOUT=true`, after credentials/callbacks tested

This is the highest-risk stage — it is the only one that can affect
real customer payments.

- **Pre-requisite:** `npm run validate:paynow` passes against
  production credentials; `PAYNOW_RESULT_URL`/`PAYNOW_RETURN_URL` point
  at real, reachable production URLs (not localhost); a full test-mode
  payment has been completed successfully in staging, including the
  callback updating order status.
- **Env var change:** `USE_PAYNOW_CHECKOUT=true`.
- **User-visible effect:** the checkout page renders the Paynow flow
  instead of Stripe Elements; `/api/checkout/paynow/*` and
  `/api/payments/paynow/*` become live.
- **Recommended sequence:** enable in production during low-traffic
  hours; place one real, small, refundable test order end-to-end before
  declaring success; watch the callback path closely for the first
  several real orders.
- **Monitoring:** Paynow callback success/failure rate, order-creation
  error rate, payment-status transition latency (initiate → callback →
  order marked paid), any `PaynowConfigError` or callback signature
  verification failures in logs.
- **Rollback:** set `USE_PAYNOW_CHECKOUT=false`. Checkout immediately
  reverts to Stripe Elements; `/api/checkout/paynow/*` and
  `/api/payments/paynow/*` return 404 again. Any orders already placed
  through Paynow remain in the database (payments/orders are additive,
  not exclusive) — this does not need to be undone.

### Stage G — `USE_NATIVE_ADMIN`, off initially, then enabled after training

- **Env var change:** `USE_NATIVE_ADMIN=true` (requires
  `USE_NATIVE_AUTH=true` to already be on — see §"Flag activation
  sequence" preconditions and `adminAccess.ts`).
- **User-visible effect:** `/native-admin/*` becomes reachable to an
  authorized admin session. It is read-only (see
  `docs/parallel-validation.md` item 10) — no admin workflow is removed
  from `/admin` (Payload admin) at this stage.
- **Sequence:** keep off in production until admin staff have been
  walked through the new read-only views in staging, so the first time
  they see it in production is not a surprise.
- **Monitoring:** access logs for `/native-admin/*` (confirm only
  expected admin accounts are reaching it), `AdminAccessService`
  denial/allow counts if logged.
- **Rollback:** set `USE_NATIVE_ADMIN=false`. `/native-admin/*` returns
  404 again; `/admin` (Payload) is unaffected throughout — it was never
  touched by any phase.

---

## 4. Smoke tests after each stage

Run the relevant subset of the manual smoke-test checklist in
`docs/parallel-validation.md` after every stage above, plus:

- `npm run validate:flags` — confirm the live flag state matches what
  you intended to change (catches env var typos/propagation delays).
- `npm run validate:db` — confirm the native connection is still
  healthy (relevant from Stage D onward).
- `npm run validate:stripe` — confirm the rollback path is still
  healthy (relevant at every stage, but especially before/after Stage
  F, since that's the stage that touches the Stripe alternative).
- `npm run validate:paynow` — confirm Paynow config is still valid
  (relevant from Stage F onward).

---

## 5. Monitoring checks

Ongoing, for the duration of the cutover window and for at least 24–48
hours after each production flag change:

- **Error rate / 5xx rate** on all storefront and API routes, segmented
  by route if your platform supports it (isolates a regression to
  native reads vs. native auth vs. Paynow vs. unrelated).
- **Response time (p50/p95/p99)** on category/product/page routes
  (Stage D) and checkout-related routes (Stage F).
- **Database connection count** — two separate Mongoose connections
  (Payload's default connection + the native
  `src/lib/db/connection.ts` connection) now share one database;
  watch for connection pool exhaustion, especially right after Stage D.
- **Payment success/failure counts**, split by provider (Stripe vs.
  Paynow) — a sudden drop in either should be investigated immediately.
- **Paynow callback delivery** — Paynow calls `PAYNOW_RESULT_URL`
  asynchronously; monitor for callbacks that never arrive (order stuck
  in a pending/initiated state past a reasonable timeout).
- **Auth error rate** on `/api/auth-native/*` and `/api/users/*` after
  Stage E.
- **`/native-admin/*` access patterns** after Stage G — unexpected
  traffic here is more likely to indicate a misconfigured link/bookmark
  than an attack, since it's behind the same session auth as everything
  else, but it's worth a glance.

---

## 6. Data safety checks

- Before Stage C: confirmed backup exists (§1).
- After each `--apply` migration run: the script's own report
  (`migrated`/`skipped`/`errors` counts) reviewed for unexpected
  `errors` entries — investigate any non-zero `errors` count before
  proceeding to the next script.
- After Stage C: spot-check a handful of Order and Product documents
  directly (via `/admin` or a read-only query) to confirm the new
  native fields look correct against a few documents you can manually
  verify (a known order total, a known product price).
- No stage in this runbook drops a collection, deletes a document, or
  alters a schema. If a future phase proposes doing so, it requires a
  new backup and a new, separate runbook — do not extend this one to
  cover destructive operations.

---

## 7. Rollback plan (summary)

| Stage | Rollback action | Data to undo? |
|---|---|---|
| A — deploy, flags off | Redeploy previous release | No |
| B — dry-run migrations | None needed (no writes) | No |
| C — migrations `--apply` | Restore from §1 backup (should not be needed — additive/idempotent) | Only if restore is actually invoked |
| D — `USE_NATIVE_REPOSITORY` | Set flag `false`, redeploy/restart | No |
| E — `USE_NATIVE_AUTH` | Set flag `false`, redeploy/restart | No |
| F — `USE_PAYNOW_CHECKOUT` | Set flag `false`, redeploy/restart | No (orders already placed via Paynow are kept) |
| G — `USE_NATIVE_ADMIN` | Set flag `false`, redeploy/restart | No |

Every flag-based rollback (D–G) is a single env var change plus a
restart — no code deploy is required if the platform supports runtime
env var updates; otherwise it's a redeploy of the same commit with a
changed env var, which should be fast. This is why the flags exist:
**the rollback for stages D through G is always faster than the
forward action**, since enabling a flag additionally implies "run smoke
tests," while disabling one does not.

---

## 8. Go/no-go criteria

Before advancing to the **next** stage, all of the following must be
true for the **current** stage:

- [ ] All smoke tests for this stage pass in production (not just
      staging)
- [ ] Error rate and response time are within normal bounds for at
      least one full business-hours cycle (or 24 hours, whichever is
      longer) after the change
- [ ] No `errors` entries in any migration report that haven't been
      individually investigated and understood
- [ ] `npm run validate:flags` output matches the intended state
- [ ] On-call owner is available and has explicitly signed off — do not
      advance a stage right before a shift handoff or outside a change
      window
- [ ] For Stage F specifically: at least one successful real (or
      test-mode-on-production-credentials, if Paynow supports it) Paynow
      payment has completed end-to-end, including the callback updating
      order status correctly

If any criterion fails, stay at the current stage (or roll back per §7)
and investigate before proceeding.

---

## 9. Incident response notes

- **If a stage's rollback (§7) does not resolve the issue:** the issue
  is likely not caused by that stage's flag. Check the deploy itself
  (Stage A path) and any concurrent, unrelated changes before assuming
  a deeper problem with the native/Paynow code.
- **If Paynow callbacks stop arriving (Stage F):** roll back
  `USE_PAYNOW_CHECKOUT` immediately — this is a payment-affecting
  condition, not a cosmetic one. Customers with in-flight Paynow
  payments at the moment of rollback should be checked manually; their
  orders may need manual reconciliation since the callback that would
  have marked them paid may not arrive after the route returns 404.
  Coordinate with whoever owns the Paynow merchant relationship if this
  happens.
- **If the native database connection is exhausting connection pool
  slots (Stage D):** rolling back `USE_NATIVE_REPOSITORY` stops new
  native-path queries but does not immediately close already-open
  connections — a restart may be needed to fully recover, not just the
  env var flip.
- **If in doubt, roll back the most recently changed flag first**, then
  reassess. Rolling back is always the cheaper, safer default action
  compared to attempting a forward fix under pressure.
- **Do not** use this incident-response window to attempt removing
  Payload or Stripe, even partially, "since it's already broken" — see
  the Stop Condition below. A payment/data incident is the worst time
  to make an irreversible change.

---

## Stop condition

This runbook, and Phase 12 generally, covers **cutover only** — moving
traffic to the native/Paynow paths behind reversible flags, with
Payload and Stripe fully intact as a fallback throughout.

**Do not use this runbook to justify removing Payload or Stripe, or any
other irreversible/destructive production change.** That is explicitly
out of scope for Phase 12 and requires separate, explicit approval and
its own planning document.
