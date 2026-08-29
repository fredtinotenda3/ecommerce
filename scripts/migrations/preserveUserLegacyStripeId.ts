// scripts/migrations/preserveUserLegacyStripeId.ts
//
// Copies each User's existing `stripeCustomerID` into the new
// `legacyStripeCustomerId` field, additively. `stripeCustomerID` itself is
// left completely untouched — see the parallel comment in
// preserveProductLegacyStripeId.ts for the full rationale, which applies
// identically here.
//
// SAFETY PROPERTIES:
//   1. Dry-run by default. Run with `--apply` to actually write.
//   2. Never overwrites an already-populated `legacyStripeCustomerId`
//      unless `--force` is also passed.
//   3. Never touches, renames, or deletes `stripeCustomerID`.
//   4. Produces a detailed report (see migrationRunner.ts).
//   5. Safe to run repeatedly.
//
// Usage:
//   npm run migration:users:legacy-stripe-id                # dry run
//   npm run migration:users:legacy-stripe-id -- --apply
//   npm run migration:users:legacy-stripe-id -- --apply --force

import 'dotenv/config'
import { getDbConnection, closeDbConnection } from '../../src/lib/db/connection'
import { getUserModel, type UserDocument } from '../../src/lib/db/models/User'
import { computeLegacyFieldDecision } from './lib/legacyStripeIdBackfill'
import { runMigration, type MigrationContext } from './lib/migrationRunner'

const migrateUsers = async (ctx: MigrationContext, force: boolean): Promise<void> => {
  const connection = await getDbConnection()
  const Model = getUserModel(connection)

  const users = await Model.find({}).lean<UserDocument[]>().exec()

  ctx.log(`Found ${users.length} user(s) to consider.`)

  for (const user of users as unknown as UserDocument[]) {
    const id = user._id.toString()

    const decision = computeLegacyFieldDecision(
      {
        id,
        legacySourceValue: user.stripeCustomerID,
        currentTargetValue: user.legacyStripeCustomerId,
      },
      force,
    )

    if (decision.action === 'skip') {
      ctx.recordResult({
        id,
        action: 'skipped',
        reason: decision.reason,
        before: { legacyStripeCustomerId: user.legacyStripeCustomerId ?? null },
      })
      continue
    }

    const before = { legacyStripeCustomerId: user.legacyStripeCustomerId ?? null }
    const after = { legacyStripeCustomerId: decision.targetValue }

    if (!ctx.dryRun) {
      await Model.findByIdAndUpdate(id, {
        $set: { legacyStripeCustomerId: decision.targetValue },
      }).exec()
    }

    ctx.recordResult({
      id,
      action: 'migrated',
      before,
      after,
      reason: ctx.dryRun ? 'would set legacyStripeCustomerId from stripeCustomerID' : undefined,
    })
  }
}

const main = async (): Promise<void> => {
  const force = process.argv.includes('--force')

  await runMigration('preserve-user-legacy-stripe-id', ctx => migrateUsers(ctx, force))

  await closeDbConnection()
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[preserve-user-legacy-stripe-id] Fatal error:', err)
  process.exitCode = 1
})
