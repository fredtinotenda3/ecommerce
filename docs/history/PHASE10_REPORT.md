# PHASE 10 IMPLEMENTATION REPORT

## Migrations Implemented

1. **`backfillProductPrices.ts`** (pre-existing) — inspected and verified
   against the current `Product` schema and `priceJSON` shape. No changes
   were needed; it correctly parses `priceJSON`, never overwrites an
   already-set `price` without `--force`, and never touches `priceJSON`/
   `stripeProductID`.
2. **`preserveProductLegacyStripeId.ts`** (new) — copies
   `Product.stripeProductID` → `Product.legacyStripeProductId`.
3. **`preserveUserLegacyStripeId.ts`** (new) — copies
   `User.stripeCustomerID` → `User.legacyStripeCustomerId`.
4. **`backfillOrders.ts`** (new) — backfills `orderNumber`, `status`,
   `subtotal`, `currency`, and item-level `title`/`currency` snapshots on
   existing `Order` documents.
5. **`backfillHistoricalStripePayments.ts`** (new) — creates one `Payment`
   document per existing Stripe order that doesn't already have one.

## Fields Backfilled/Added

| Collection | Field | Source |
|---|---|---|
| `products` | `price`, `currency` (existing script) | parsed from `priceJSON` |
| `products` | `legacyStripeProductId` | copied from `stripeProductID` |
| `users` | `legacyStripeCustomerId` | copied from `stripeCustomerID` |
| `orders` | `orderNumber` | derived deterministically from `_id` + `createdAt` (format `ORD-yymmdd-XXXXXXXX`, `XXXXXXXX` = last 8 hex chars of `_id`) |
| `orders` | `status` | set to `PAID` (see "Historical Stripe Preservation" below) |
| `orders` | `subtotal` | copied from existing `total` (never recalculated) |
| `orders` | `currency` | existing order/item currency, else `USD` fallback |
| `orders.items[]` | `title` | looked up from the current `Product.title`, else `"Unknown product"` |
| `orders.items[]` | `currency` | same resolved order currency as above |
| `payments` (new doc) | `provider: 'stripe'`, `providerReference`, `merchantReference`, `amount`, `currency`, `status: 'PAID'`, `paidAt` | derived from the corresponding historical order — see below |

No existing field (`priceJSON`, `stripeProductID`, `stripeCustomerID`,
`stripePaymentIntentID`, `total`, `items[].price`) was ever written to or
deleted by any script in this phase.

## Idempotency Approach

- **Legacy-id preservation scripts**: skip if the target field is already
  populated (unless `--force`); skip if there's no source value to copy;
  with `--force`, a no-op if source and target already match.
- **Order backfill**: each target field is backfilled independently and
  only when missing (or with `--force`); `orderNumber` is derived
  **deterministically** from the order's own `_id` (not randomly, unlike
  the native `generateOrderNumber` used for brand-new orders), so
  re-running produces the exact same value every time. An order with
  every target field already populated is reported `skipped` and no write
  is issued.
- **Payment backfill**: skips any order that already has a `Payment`
  document (checked by `orderId` before insert). As a second,
  database-enforced layer, `payments.merchantReference` has a **unique
  index** (already present on the `Payment` model) — if two runs raced,
  the resulting Mongo duplicate-key error (code `11000`) is caught
  per-record and reported as `skipped`, not treated as a fatal script
  error.
- All decision logic is implemented as pure functions
  (`scripts/migrations/lib/*Backfill.ts`) with zero Mongo/Mongoose
  dependency, so the "would this be a no-op the second time?" property is
  directly unit-tested (see `tests/migrations/orderBackfill.test.ts`'s
  explicit idempotency test and `paymentBackfill.test.ts`'s "same order
  always produces the same payment shape" test).

## Dry-Run Behavior

Every new script uses the existing `runMigration`/`parseDryRunFlag`
framework: dry-run is the default, and only an explicit `--apply` flag
enables writes. In dry-run mode, every script still performs its full
read/decision pass and produces a complete JSON+console report under
`scripts/migrations/reports/`, with each record's `action` (`migrated`/
`skipped`/`error`) and a `reason` explaining what *would* happen — no
`findByIdAndUpdate`/`.create()` calls are issued while `ctx.dryRun` is
true.

## Historical Stripe Preservation

- **Products/Users**: `stripeProductID` and `stripeCustomerID` are left
  completely untouched. `legacyStripeProductId`/`legacyStripeCustomerId`
  are new, additive, nullable fields that duplicate the same value under a
  migration-owned name. `ProductRepository`/`UserRepository` were updated
  to read the new field first, falling back to the original Stripe field,
  so the mapping is correct whether or not the backfill has reached a
  given document yet.
- **Orders**: `stripePaymentIntentID` is left untouched and is the sole
  signal used to identify "this order came from the legacy Stripe
  checkout flow."
- **Status assumption**: the legacy checkout
  (`src/app/(pages)/checkout/CheckoutForm/index.tsx`) only `POST`s to
  `/api/orders` **after** `stripe.confirmPayment` has already succeeded —
  there is no code path that creates an order document before payment
  completes. This means every existing order with no native `status` yet
  is, by construction, already paid. The order backfill therefore sets
  `status: 'PAID'` for any order missing a status, per the Phase 10 spec.
- **Payments**: one `Payment` document is created per historical Stripe
  order, with `provider: 'stripe'`, `providerReference` = the order's
  existing `stripePaymentIntentID`, `merchantReference` = the order's
  (now-backfilled, or deterministically-derived-as-fallback)
  `orderNumber`, `amount` = the order's existing `total` (never
  recalculated), `currency` = the order's existing/backfilled currency,
  `status: 'PAID'`, and `paidAt` = the order's `createdAt` as a
  best-effort approximation.

## Assumptions

1. Every pre-migration order was created via the legacy Stripe checkout
   flow and only after a successful payment — so "missing status" ⇒
   "PAID" is safe and there is no "historical unpaid order" case to model.
2. There is no tax/shipping/discount concept in the current data (the
   native `computeTotal` is literally `subtotal + 0`), so `subtotal` can
   safely be copied from the existing `total` rather than resummed from
   items.
3. `orderNumber` does not need to match any customer-facing value that
   already existed prior to this migration (none did — `orderNumber` is a
   brand-new field), so a deterministic, migration-generated value is an
   acceptable choice, and is preferable to a random one for
   idempotency/auditability.
4. Where a historical order's `orderNumber` hasn't been backfilled yet
   (e.g. the payment-backfill script is run before the order-backfill
   script), the payment backfill falls back to a deterministic
   `LEGACY-STRIPE-<orderId>` merchant reference rather than depending on
   run order between the two scripts.
5. `USD` is a reasonable currency fallback given the codebase's existing
   hardcoded `'USD'` in `Price/index.tsx`'s display logic.

## Files Created

- `scripts/migrations/lib/legacyStripeIdBackfill.ts`
- `scripts/migrations/lib/orderBackfill.ts`
- `scripts/migrations/lib/paymentBackfill.ts`
- `scripts/migrations/preserveProductLegacyStripeId.ts`
- `scripts/migrations/preserveUserLegacyStripeId.ts`
- `scripts/migrations/backfillOrders.ts`
- `scripts/migrations/backfillHistoricalStripePayments.ts`
- `tests/migrations/legacyStripeIdBackfill.test.ts`
- `tests/migrations/orderBackfill.test.ts`
- `tests/migrations/paymentBackfill.test.ts`

## Files Modified

- `package.json` (4 new `migration:*` scripts)
- `src/lib/db/models/Product.ts` (added `legacyStripeProductId`)
- `src/lib/db/models/User.ts` (added `legacyStripeCustomerId`)
- `src/lib/repositories/ProductRepository.ts` (mapping fallback)
- `src/lib/repositories/UserRepository.ts` (mapping fallback)

## Files Deleted

None.

## New Dependencies

None.

## Validation Results

- **lint** (`npm run lint`): 0 errors.
- **typecheck** (`npx tsc --noEmit`): only the same 1 pre-existing error in
  `src/app/_blocks/ArchiveBlock/index.tsx` (unrelated to this phase); no
  new errors introduced.
- **tests** (`npm run test`): **250 passed** (221 pre-existing + 29 new
  across the 3 new migration test files), 0 failed.
- `npm run build` was **not** run, per the Phase 10 instructions.
- No migration script was executed against any database, local or
  otherwise, in this phase — only pure-logic unit tests were run.

## Existing Storefront/Checkout/Auth/Admin status

Untouched. The only production-code changes in this phase are the two new
optional schema fields and the two repository `toDomain` fallback edits,
all of which are backward-compatible (existing documents without the new
field still map correctly via the fallback) and do not change any
storefront, checkout, auth, or admin behavior or code path.

## Remaining Risks

- The deterministic `orderNumber` scheme derives its suffix from the last
  8 hex characters of the Mongo `_id`. Collisions are not possible across
  distinct orders (Mongo `_id`s are unique), but this does mean the
  human-facing order number is not independently random the way
  `generateOrderNumber()` (used for brand-new orders) is — this is a
  deliberate, migration-only choice and does not affect new orders.
- The order-item `title` backfill takes a snapshot of the **current**
  `Product.title` at migration time, which may not exactly match what the
  product was titled when the historical order was actually placed if the
  title has since changed. This is unavoidable without a separate
  historical record and is consistent with "best-effort" snapshot intent.
- `backfillHistoricalStripePayments.ts` should be run after
  `backfillOrders.ts` for the cleanest `merchantReference` values (real
  order numbers instead of the `LEGACY-STRIPE-<id>` fallback), though it
  is safe to run in either order.
- None of these scripts have yet been exercised against a real (even
  disposable/local) database in this phase — only unit-tested pure logic.
  Running each script's dry-run mode against a real staging copy of the
  data before `--apply` is strongly recommended as the very first step of
  the next phase.

## Recommended Next Phase

Run all four new/verified migrations in `--dry-run` (default) mode against
a disposable copy of production-like data, review the generated JSON
reports under `scripts/migrations/reports/` for unexpected `error` entries
or surprising `skipped` reasons, then `--apply` them in this order:
`backfillProductPrices` → `preserveProductLegacyStripeId` →
`preserveUserLegacyStripeId` → `backfillOrders` →
`backfillHistoricalStripePayments`. Only after that validation should
parallel-validation or cutover planning begin — both remain explicitly
out of scope until approved.

---

**STOP CONDITION HONORED**: no production cutover, parallel validation, or
Stripe/Payload removal was started. Waiting for explicit approval before
any of those next steps.
