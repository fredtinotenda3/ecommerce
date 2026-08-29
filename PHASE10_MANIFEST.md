# PHASE 10 — FILE MANIFEST

All paths are relative to the repository root. This is the complete
contents of `phase10-migrations.zip` — no other files were changed.

## Modified

- `package.json` — added 4 new `migration:*` npm scripts
- `src/lib/db/models/Product.ts` — added optional `legacyStripeProductId` field
- `src/lib/db/models/User.ts` — added optional `legacyStripeCustomerId` field
- `src/lib/repositories/ProductRepository.ts` — `toDomain` now prefers the new
  persisted field, falling back to `stripeProductID`
- `src/lib/repositories/UserRepository.ts` — `toDomain` now prefers the new
  persisted field, falling back to `stripeCustomerID`

## Created

- `scripts/migrations/lib/legacyStripeIdBackfill.ts` — shared pure decision logic
- `scripts/migrations/lib/orderBackfill.ts` — pure decision logic for order backfill
- `scripts/migrations/lib/paymentBackfill.ts` — pure decision logic for historical payment backfill
- `scripts/migrations/preserveProductLegacyStripeId.ts` — migration script
- `scripts/migrations/preserveUserLegacyStripeId.ts` — migration script
- `scripts/migrations/backfillOrders.ts` — migration script
- `scripts/migrations/backfillHistoricalStripePayments.ts` — migration script
- `tests/migrations/legacyStripeIdBackfill.test.ts`
- `tests/migrations/orderBackfill.test.ts`
- `tests/migrations/paymentBackfill.test.ts`

## Deleted

None.

## Not included (unchanged)

- `scripts/migrations/backfillProductPrices.ts` — inspected, verified correct
  against the current data shape, **not modified**
- `scripts/migrations/lib/migrationRunner.ts` — inspected, reused as-is,
  **not modified**
