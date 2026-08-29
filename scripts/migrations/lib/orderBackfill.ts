// scripts/migrations/lib/orderBackfill.ts
//
// Pure decision logic for backfilling additive fields onto existing Order
// documents: `orderNumber`, `status`, `subtotal`, `currency`, and
// item-level `title`/`currency` snapshots. Zero Mongoose/Mongo knowledge —
// see tests/migrations/orderBackfill.test.ts.
//
// KEY RULE (Phase 10 spec): never recalculate item prices from current
// product prices, and never touch `total` or item `price`. This module
// only ever fills in fields that are missing (or, with --force, resets
// them from other existing fields on the same order) — it never derives a
// price from anything.
//
// STATUS ASSUMPTION: every existing order was created by the legacy Stripe
// checkout flow (src/app/(pages)/checkout/CheckoutForm/index.tsx), which
// only POSTs to /api/orders AFTER `stripe.confirmPayment` has already
// succeeded — see that file's `handleSubmit`. So an order with no native
// `status` yet is, by construction, an order that was already paid for.
// This migration therefore backfills `status: 'PAID'` for any order
// missing a status, and does NOT attempt to distinguish paid vs. unpaid
// historical orders (there is no such thing pre-migration).

export interface LegacyOrderItemInput {
  product?: string | null
  title?: string | null
  price?: number | null
  currency?: string | null
  quantity?: number | null
}

export interface LegacyOrderInput {
  id: string
  createdAt: Date
  orderNumber?: string | null
  status?: string | null
  subtotal?: number | null
  currency?: string | null
  total?: number | null
  items?: LegacyOrderItemInput[] | null
}

export interface OrderItemPatch {
  index: number
  title?: string
  currency?: string
}

export interface OrderBackfillPatch {
  orderNumber?: string
  status?: 'PAID'
  subtotal?: number
  currency?: string
  items?: OrderItemPatch[]
}

export interface OrderBackfillDecision {
  id: string
  action: 'migrate' | 'skip'
  reason?: string
  patch?: OrderBackfillPatch
}

const FALLBACK_CURRENCY = 'USD'
const HISTORICAL_STATUS = 'PAID' as const

/** Deterministic, collision-resistant order number derived from the
 * order's own Mongo ObjectId (already globally unique) and its creation
 * date. Deliberately NOT randomized (unlike the native
 * `generateOrderNumber` used for brand-new orders in
 * src/lib/services/pricing.ts) — this migration must produce the exact
 * same value every time it looks at the same order, so re-running it (or
 * running it a second time after a partial failure) is a genuine no-op
 * rather than "generates a different value, but that's fine because we
 * only write it once anyway". Determinism is the property that makes that
 * true. */
export const deriveDeterministicOrderNumber = (id: string, createdAt: Date): string => {
  const yy = String(createdAt.getUTCFullYear()).slice(2)
  const mm = String(createdAt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(createdAt.getUTCDate()).padStart(2, '0')
  const suffix = id.slice(-8).toUpperCase().padStart(8, '0')
  return `ORD-${yy}${mm}${dd}-${suffix}`
}

const resolveCurrency = (
  order: LegacyOrderInput,
  productTitleByProductId: Map<string, string>,
): string => {
  if (typeof order.currency === 'string' && order.currency.length > 0) {
    return order.currency
  }
  const fromItem = (order.items ?? []).find(
    item => typeof item.currency === 'string' && item.currency.length > 0,
  )
  if (fromItem?.currency) return fromItem.currency
  // productTitleByProductId is unused for currency resolution today, but
  // accepted for symmetry with computeOrderBackfillPatch's signature and
  // in case a future product-level currency fallback is added here.
  void productTitleByProductId
  return FALLBACK_CURRENCY
}

/** Decides the additive patch (if any) for a single order.
 * `productTitleByProductId` should contain a best-effort title lookup for
 * every `items[].product` referenced by this order — pass an empty Map if
 * unavailable, in which case missing item titles fall back to
 * 'Unknown product' rather than being left blank. */
export const computeOrderBackfillPatch = (
  order: LegacyOrderInput,
  force: boolean,
  productTitleByProductId: Map<string, string> = new Map(),
): OrderBackfillDecision => {
  const patch: OrderBackfillPatch = {}

  const needsOrderNumber =
    force || typeof order.orderNumber !== 'string' || order.orderNumber.length === 0
  if (needsOrderNumber) {
    patch.orderNumber = deriveDeterministicOrderNumber(order.id, order.createdAt)
  }

  const needsStatus = force || typeof order.status !== 'string' || order.status.length === 0
  if (needsStatus) {
    patch.status = HISTORICAL_STATUS
  }

  const resolvedCurrency = resolveCurrency(order, productTitleByProductId)
  const needsCurrency = force || typeof order.currency !== 'string' || order.currency.length === 0
  if (needsCurrency) {
    patch.currency = resolvedCurrency
  }

  // Never recalculated from products — always sourced from the order's
  // own existing `total`, which itself is never touched.
  const needsSubtotal = force || typeof order.subtotal !== 'number'
  if (needsSubtotal) {
    patch.subtotal = order.total ?? 0
  }

  const itemPatches: OrderItemPatch[] = []
  ;(order.items ?? []).forEach((item, index) => {
    const itemPatch: OrderItemPatch = { index }
    let changed = false

    const needsTitle = force || typeof item.title !== 'string' || item.title.length === 0
    if (needsTitle) {
      const productId = item.product ?? undefined
      itemPatch.title =
        (productId && productTitleByProductId.get(productId)) || 'Unknown product'
      changed = true
    }

    const needsItemCurrency =
      force || typeof item.currency !== 'string' || item.currency.length === 0
    if (needsItemCurrency) {
      itemPatch.currency = resolvedCurrency
      changed = true
    }

    if (changed) itemPatches.push(itemPatch)
  })

  if (itemPatches.length > 0) {
    patch.items = itemPatches
  }

  const hasAnyChange =
    patch.orderNumber !== undefined ||
    patch.status !== undefined ||
    patch.currency !== undefined ||
    patch.subtotal !== undefined ||
    (patch.items !== undefined && patch.items.length > 0)

  if (!hasAnyChange) {
    return { id: order.id, action: 'skip', reason: 'all target fields already populated' }
  }

  return { id: order.id, action: 'migrate', patch }
}

/** Applies an OrderItemPatch list onto a copy of the original items array,
 * for building the Mongo `$set` payload. Pure — does not mutate the input. */
export const applyItemPatches = (
  items: LegacyOrderItemInput[],
  itemPatches: OrderItemPatch[] = [],
): LegacyOrderItemInput[] => {
  const byIndex = new Map(itemPatches.map(p => [p.index, p]))
  return items.map((item, index) => {
    const p = byIndex.get(index)
    if (!p) return item
    return {
      ...item,
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.currency !== undefined ? { currency: p.currency } : {}),
    }
  })
}
