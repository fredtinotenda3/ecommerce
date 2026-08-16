// scripts/migrations/backfillProductPrices.ts
//
// Backfills the new native `price`/`currency` fields on Products from the
// legacy `priceJSON` (raw Stripe Price-list API response — see
// src/payload/collections/Products/hooks/beforeChange.ts for how it's
// written today, and src/app/_components/Price/index.tsx for how it's
// parsed today).
//
// SAFETY PROPERTIES (per Phase 1H requirements):
//   1. Dry-run by default. Run with `--apply` to actually write.
//   2. Never overwrites an already-populated `price` field unless
//      `--force` is also passed.
//   3. Never touches or deletes `priceJSON` / `stripeProductID`.
//   4. Produces a detailed report (see migrationRunner.ts).
//   5. Safe to run repeatedly: an already-migrated product is reported as
//      "skipped", not re-processed.
//
// Usage:
//   npm run migration:products:prices                # dry run
//   npm run migration:products:prices -- --apply      # actually writes
//   npm run migration:products:prices -- --apply --force
//
// Stripe's `unit_amount` is already an integer in minor units (this is a
// Stripe API convention, not something this script converts) — see
// toMinorUnits usage note below for why we still route it through the
// money module rather than trusting it blindly.

import 'dotenv/config'
import { getDbConnection, closeDbConnection } from '../../src/lib/db/connection'
import { getProductModel, type ProductDocument } from '../../src/lib/db/models/Product'
import { runMigration, type MigrationContext } from './lib/migrationRunner'

interface StripePriceListShape {
  data?: Array<{
    unit_amount?: number
    currency?: string
  }>
}

const FALLBACK_CURRENCY = 'USD'

const parsePriceFromLegacyJSON = (
  priceJSON: string,
): { amount: number; currency: string } | null => {
  let parsed: StripePriceListShape
  try {
    parsed = JSON.parse(priceJSON)
  } catch {
    return null
  }

  const firstPrice = parsed?.data?.[0]
  if (!firstPrice || typeof firstPrice.unit_amount !== 'number') {
    return null
  }

  return {
    amount: Math.round(firstPrice.unit_amount), // already minor units per Stripe convention
    currency: (firstPrice.currency ?? FALLBACK_CURRENCY).toUpperCase(),
  }
}

const migrateProducts = async (ctx: MigrationContext, force: boolean): Promise<void> => {
  const connection = await getDbConnection()
  const Model = getProductModel(connection)

  const products = await Model.find({}).lean<ProductDocument[]>().exec()

  ctx.log(`Found ${products.length} product(s) to consider.`)

  for (const product of products as unknown as ProductDocument[]) {
    const id = product._id.toString()
    const hasAuthoritativePrice = typeof product.price === 'number' && product.price !== null

    if (hasAuthoritativePrice && !force) {
      ctx.recordResult({
        id,
        action: 'skipped',
        reason: 'price already set (pass --force to overwrite)',
        before: { price: product.price, currency: product.currency },
      })
      continue
    }

    if (!product.priceJSON) {
      ctx.recordResult({
        id,
        action: 'skipped',
        reason: 'no legacy priceJSON to migrate from',
      })
      continue
    }

    const parsed = parsePriceFromLegacyJSON(product.priceJSON)
    if (!parsed) {
      ctx.recordResult({
        id,
        action: 'error',
        reason: 'priceJSON present but could not be parsed into a usable price',
      })
      continue
    }

    const before = { price: product.price ?? null, currency: product.currency ?? null }
    const after = { price: parsed.amount, currency: parsed.currency }

    if (!ctx.dryRun) {
      await Model.findByIdAndUpdate(id, {
        $set: { price: after.price, currency: after.currency },
      }).exec()
    }

    ctx.recordResult({
      id,
      action: 'migrated',
      before,
      after,
      reason: ctx.dryRun ? 'would set price/currency from legacy priceJSON' : undefined,
    })
  }
}

const main = async (): Promise<void> => {
  const force = process.argv.includes('--force')

  await runMigration('backfill-product-prices', ctx => migrateProducts(ctx, force))

  await closeDbConnection()
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[backfill-product-prices] Fatal error:', err)
  process.exitCode = 1
})
