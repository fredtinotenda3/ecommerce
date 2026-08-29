// scripts/migrations/lib/paymentBackfill.ts
//
// Pure decision logic for creating one `Payment` document per historical
// Stripe order. Zero Mongoose/Mongo knowledge — see
// tests/migrations/paymentBackfill.test.ts.
//
// IDEMPOTENCY: this module only ever describes what a Payment document
// SHOULD look like for a given order; the calling script
// (backfillHistoricalStripePayments.ts) is responsible for checking
// whether one already exists (by orderId) before creating it, AND the
// Payment collection has a unique index on `merchantReference` (see
// src/lib/db/models/Payment.ts) as a second, database-enforced layer of
// protection against duplicates even if two runs raced each other.

export interface LegacyOrderForPaymentBackfill {
  id: string
  createdAt: Date
  total?: number | null
  currency?: string | null
  orderNumber?: string | null
  stripePaymentIntentID?: string | null
}

export interface HistoricalPaymentInput {
  orderId: string
  provider: 'stripe'
  providerReference: string
  merchantReference: string
  amount: number
  currency: string
  status: 'PAID'
  paidAt: Date
}

const FALLBACK_CURRENCY = 'USD'

/** Used only when the order has no `orderNumber` yet (i.e. the order
 * backfill migration hasn't run, or hasn't reached this order, yet).
 * Deterministic in the order id alone, so it's stable across runs and
 * across whether or not the order backfill has happened. */
export const deriveFallbackMerchantReference = (orderId: string): string =>
  `LEGACY-STRIPE-${orderId}`

export interface PaymentBackfillDecision {
  orderId: string
  action: 'create' | 'skip'
  reason?: string
  payment?: HistoricalPaymentInput
}

/** Decides whether a historical Payment should be created for this order,
 * and if so, what it should contain. `hasExistingPayment` must be
 * supplied by the caller (a query against the Payment collection) — this
 * function has no way to know that on its own. */
export const computeHistoricalPaymentDecision = (
  order: LegacyOrderForPaymentBackfill,
  hasExistingPayment: boolean,
): PaymentBackfillDecision => {
  if (!order.stripePaymentIntentID) {
    return {
      orderId: order.id,
      action: 'skip',
      reason: 'order has no stripePaymentIntentID (not a historical Stripe order)',
    }
  }

  if (hasExistingPayment) {
    return {
      orderId: order.id,
      action: 'skip',
      reason: 'a Payment document already exists for this order',
    }
  }

  const merchantReference =
    typeof order.orderNumber === 'string' && order.orderNumber.length > 0
      ? order.orderNumber
      : deriveFallbackMerchantReference(order.id)

  return {
    orderId: order.id,
    action: 'create',
    payment: {
      orderId: order.id,
      provider: 'stripe',
      providerReference: order.stripePaymentIntentID,
      merchantReference,
      // Preserved exactly as-is from the order's existing `total` — never
      // recalculated from current product prices.
      amount: order.total ?? 0,
      currency:
        typeof order.currency === 'string' && order.currency.length > 0
          ? order.currency
          : FALLBACK_CURRENCY,
      status: 'PAID',
      // Best-effort: the order's own `createdAt` is the closest available
      // signal for when the (already-successful, per the legacy
      // checkout's own logic) Stripe payment actually completed.
      paidAt: order.createdAt,
    },
  }
}
