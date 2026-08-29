// scripts/migrations/backfillHistoricalStripePayments.ts
//
// Creates one `Payment` document per existing Stripe order (i.e. every
// order with a `stripePaymentIntentID`) that doesn't already have one.
// See scripts/migrations/lib/paymentBackfill.ts for the full decision
// logic. The `payments` collection is brand new (see
// src/lib/db/models/Payment.ts) — this migration is purely additive, it
// never touches the `orders` collection at all.
//
// SAFETY PROPERTIES:
//   1. Dry-run by default. Run with `--apply` to actually write.
//   2. Idempotent: an order that already has a Payment document is
//      skipped. As a second, database-enforced layer of protection, the
//      `payments` collection has a unique index on `merchantReference`
//      (see src/lib/db/models/Payment.ts) — if a duplicate slips through
//      the pre-check anyway (e.g. a concurrent run), the resulting
//      duplicate-key error is caught per-record and reported as
//      "skipped", not treated as a fatal script error.
//   3. `stripePaymentIntentID` is left untouched on the order — this
//      migration only ever reads it.
//   4. `order.total` is copied as-is into `payment.amount` — never
//      recalculated from current product prices.
//   5. No `--force` flag: there is nothing to "overwrite" here — either a
//      Payment exists for the order already (skip) or it doesn't (create
//      it once).
//
// Usage:
//   npm run migration:payments:backfill-historical-stripe                # dry run
//   npm run migration:payments:backfill-historical-stripe -- --apply

import 'dotenv/config'
import { getDbConnection, closeDbConnection } from '../../src/lib/db/connection'
import { getOrderModel, type OrderDocument } from '../../src/lib/db/models/Order'
import { getPaymentModel } from '../../src/lib/db/models/Payment'
import {
  computeHistoricalPaymentDecision,
  type LegacyOrderForPaymentBackfill,
} from './lib/paymentBackfill'
import { runMigration, type MigrationContext } from './lib/migrationRunner'

// Mongo duplicate-key error code, used to defensively treat a race-induced
// duplicate as "already handled" rather than a fatal error.
const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000

const toLegacyOrderInput = (doc: OrderDocument): LegacyOrderForPaymentBackfill => ({
  id: doc._id.toString(),
  createdAt: doc.createdAt,
  total: doc.total ?? null,
  currency: doc.currency ?? null,
  orderNumber: doc.orderNumber ?? null,
  stripePaymentIntentID: doc.stripePaymentIntentID ?? null,
})

const migratePayments = async (ctx: MigrationContext): Promise<void> => {
  const connection = await getDbConnection()
  const OrderModel = getOrderModel(connection)
  const PaymentModel = getPaymentModel(connection)

  const orders = await OrderModel.find({
    stripePaymentIntentID: { $exists: true, $ne: null },
  })
    .lean<OrderDocument[]>()
    .exec()

  ctx.log(`Found ${orders.length} order(s) with a stripePaymentIntentID to consider.`)

  for (const order of orders as unknown as OrderDocument[]) {
    const id = order._id.toString()
    const legacyInput = toLegacyOrderInput(order)

    const existingPayment = await PaymentModel.findOne({ orderId: id }).lean().exec()

    const decision = computeHistoricalPaymentDecision(legacyInput, Boolean(existingPayment))

    if (decision.action === 'skip') {
      ctx.recordResult({ id, action: 'skipped', reason: decision.reason })
      continue
    }

    const payment = decision.payment!

    if (!ctx.dryRun) {
      try {
        await PaymentModel.create({
          orderId: payment.orderId,
          provider: payment.provider,
          providerReference: payment.providerReference,
          merchantReference: payment.merchantReference,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          initiatedAt: payment.paidAt,
          paidAt: payment.paidAt,
        })
      } catch (err) {
        const code = (err as { code?: number })?.code
        if (code === MONGO_DUPLICATE_KEY_ERROR_CODE) {
          ctx.recordResult({
            id,
            action: 'skipped',
            reason: 'duplicate-key race: a Payment for this order/merchantReference already exists',
          })
          continue
        }
        ctx.recordResult({
          id,
          action: 'error',
          reason: err instanceof Error ? err.message : 'unknown error creating Payment',
        })
        continue
      }
    }

    ctx.recordResult({
      id,
      action: 'migrated',
      after: {
        merchantReference: payment.merchantReference,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      },
      reason: ctx.dryRun ? 'would create a historical Payment document' : undefined,
    })
  }
}

const main = async (): Promise<void> => {
  await runMigration('backfill-historical-stripe-payments', ctx => migratePayments(ctx))

  await closeDbConnection()
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[backfill-historical-stripe-payments] Fatal error:', err)
  process.exitCode = 1
})
