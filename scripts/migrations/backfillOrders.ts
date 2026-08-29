// scripts/migrations/backfillOrders.ts
//
// Backfills additive native fields onto existing Order documents:
// `orderNumber`, `status`, `subtotal`, `currency`, and item-level
// `title`/`currency` snapshots. See scripts/migrations/lib/orderBackfill.ts
// for the full decision logic and the assumptions behind it (in
// particular: why every pre-existing order is backfilled as `PAID`).
//
// SAFETY PROPERTIES:
//   1. Dry-run by default. Run with `--apply` to actually write.
//   2. Never overwrites an already-populated target field unless
//      `--force` is also passed.
//   3. NEVER recalculates `total` or any item's `price` — those are read
//      but never written by this script.
//   4. Produces a detailed report (see migrationRunner.ts).
//   5. Safe to run repeatedly: an order with every target field already
//      populated is reported as "skipped".
//
// Usage:
//   npm run migration:orders:backfill                # dry run
//   npm run migration:orders:backfill -- --apply
//   npm run migration:orders:backfill -- --apply --force

import 'dotenv/config'
import { getDbConnection, closeDbConnection } from '../../src/lib/db/connection'
import { getOrderModel, type OrderDocument } from '../../src/lib/db/models/Order'
import { getProductModel, type ProductDocument } from '../../src/lib/db/models/Product'
import {
  applyItemPatches,
  computeOrderBackfillPatch,
  type LegacyOrderInput,
} from './lib/orderBackfill'
import { runMigration, type MigrationContext } from './lib/migrationRunner'

const buildProductTitleLookup = async (
  connection: Awaited<ReturnType<typeof getDbConnection>>,
): Promise<Map<string, string>> => {
  const ProductModel = getProductModel(connection)
  const products = await ProductModel.find({}, { title: 1 }).lean<ProductDocument[]>().exec()
  const lookup = new Map<string, string>()
  for (const product of products as unknown as ProductDocument[]) {
    lookup.set(product._id.toString(), product.title)
  }
  return lookup
}

const toLegacyOrderInput = (doc: OrderDocument): LegacyOrderInput => ({
  id: doc._id.toString(),
  createdAt: doc.createdAt,
  orderNumber: doc.orderNumber ?? null,
  status: doc.status ?? null,
  subtotal: doc.subtotal ?? null,
  currency: doc.currency ?? null,
  total: doc.total ?? null,
  items: (doc.items ?? []).map(item => ({
    product: item.product ? item.product.toString() : null,
    title: item.title ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    quantity: item.quantity ?? null,
  })),
})

const migrateOrders = async (ctx: MigrationContext, force: boolean): Promise<void> => {
  const connection = await getDbConnection()
  const OrderModel = getOrderModel(connection)

  const [orders, productTitleByProductId] = await Promise.all([
    OrderModel.find({}).lean<OrderDocument[]>().exec(),
    buildProductTitleLookup(connection),
  ])

  ctx.log(`Found ${orders.length} order(s) to consider.`)

  for (const order of orders as unknown as OrderDocument[]) {
    const id = order._id.toString()
    const legacyInput = toLegacyOrderInput(order)

    const decision = computeOrderBackfillPatch(legacyInput, force, productTitleByProductId)

    if (decision.action === 'skip') {
      ctx.recordResult({ id, action: 'skipped', reason: decision.reason })
      continue
    }

    const patch = decision.patch!
    const $set: Record<string, unknown> = {}
    if (patch.orderNumber !== undefined) $set.orderNumber = patch.orderNumber
    if (patch.status !== undefined) $set.status = patch.status
    if (patch.currency !== undefined) $set.currency = patch.currency
    if (patch.subtotal !== undefined) $set.subtotal = patch.subtotal
    if (patch.items !== undefined) {
      // Mongoose will cast the `product` string back to an ObjectId on
      // write; `price`/`quantity` are carried through unchanged from the
      // existing document (applyItemPatches only ever touches
      // title/currency), so `total`/item `price` are never recalculated.
      $set.items = applyItemPatches(legacyInput.items ?? [], patch.items)
    }

    const before = {
      orderNumber: order.orderNumber ?? null,
      status: order.status ?? null,
      currency: order.currency ?? null,
      subtotal: order.subtotal ?? null,
    }

    if (!ctx.dryRun) {
      // orderNumber has a unique sparse index — a collision here (two
      // orders deriving the same deterministic value) is only possible if
      // two different orders shared the same _id, which Mongo already
      // guarantees can't happen, so no retry/catch is needed for that.
      await OrderModel.findByIdAndUpdate(id, { $set }).exec()
    }

    ctx.recordResult({
      id,
      action: 'migrated',
      before,
      after: { orderNumber: patch.orderNumber, status: patch.status, currency: patch.currency, subtotal: patch.subtotal },
      reason: ctx.dryRun ? 'would backfill additive order fields' : undefined,
    })
  }
}

const main = async (): Promise<void> => {
  const force = process.argv.includes('--force')

  await runMigration('backfill-orders', ctx => migrateOrders(ctx, force))

  await closeDbConnection()
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('[backfill-orders] Fatal error:', err)
  process.exitCode = 1
})
