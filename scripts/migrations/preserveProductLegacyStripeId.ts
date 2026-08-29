// scripts/migrations/preserveProductLegacyStripeId.ts
//
// Copies each Product's existing `stripeProductID` into the new
// `legacyStripeProductId` field, additively. `stripeProductID` itself is
// left completely untouched — this migration only ADDS a field, it never
// removes anything (removal of `stripeProductID` is explicitly out of
// scope for Phase 10, per the Phase 10 spec's DO-NOT list).
//
// SAFETY PROPERTIES:
//   1. Dry-run by default. Run with `--apply` to actually write.
//   2. Never overwrites an already-populated `legacyStripeProductId`
//      unless `--force` is also passed.
//   3. Never touches, renames, or deletes `stripeProductID`.
//   4. Produces a detailed report (see migrationRunner.ts).
//   5. Safe to run repeatedly: an already-migrated product (or a product
//      with no `stripeProductID` to preserve) is reported as "skipped".
//
// Usage:
//   npm run migration:products:legacy-stripe-id                # dry run
//   npm run migration:products:legacy-stripe-id -- --apply
//   npm run migration:products:legacy-stripe-id -- --apply --force

import 'dotenv/config'
import { getDbConnection, closeDbConnection } from '../../src/lib/db/connection'
import { getProductModel, type ProductDocument } from '../../src/lib/db/models/Product'
import { computeLegacyFieldDecision } from './lib/legacyStripeIdBackfill'
import { runMigration, type MigrationContext } from './lib/migrationRunner'

const migrateProducts = async (ctx: MigrationContext, force: boolean): Promise<void> => {
  const connection = await getDbConnection()
  const Model = getProductModel(connection)

  const products = await Model.find({}).lean<ProductDocument[]>().exec()

  ctx.log(`Found ${products.length} product(s) to consider.`)

  for (const product of products as unknown as ProductDocument[]) {
    const id = product._id.toString()

    const decision = computeLegacyFieldDecision(
      {
        id,
        legacySourceValue: product.stripeProductID,
        currentTargetValue: product.legacyStripeProductId,
      },
      force,
    )

    if (decision.action === 'skip') {
      ctx.recordResult({
        id,
        action: 'skipped',
        reason: decision.reason,
        before: { legacyStripeProductId: product.legacyStripeProductId ?? null },
      })
      continue
    }

    const before = { legacyStripeProductId: product.legacyStripeProductId ?? null }
    const after = { legacyStripeProductId: decision.targetValue }

    if (!ctx.dryRun) {
      await Model.findByIdAndUpdate(id, {
        $set: { legacyStripeProductId: decision.targetValue },
      }).exec()
    }

    ctx.recordResult({
      id,
      action: 'migrated',
      before,
      after,
      reason: ctx.dryRun ? 'would set legacyStripeProductId from stripeProductID' : undefined,
    })
  }
}

const main = async (): Promise<void> => {
  const force = process.argv.includes('--force')

  await runMigration('preserve-product-legacy-stripe-id', ctx => migrateProducts(ctx, force))

  await closeDbConnection()
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[preserve-product-legacy-stripe-id] Fatal error:', err)
  process.exitCode = 1
})
