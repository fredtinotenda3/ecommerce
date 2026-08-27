// src/lib/payments/paynow/paynowStatusMap.ts
//
// Maps the free-text `status` field Paynow sends in initiate-transaction
// responses, poll responses, and result-url callbacks onto the app's
// closed `PaymentStatus` enum ('PENDING' | 'PAID' | 'FAILED' |
// 'CANCELLED' | 'REFUNDED', see src/lib/domain/types.ts).
//
// Verified against Paynow's docs: 'Paid', 'Awaiting Delivery' and
// 'Cancelled' are directly confirmed by the worked examples on
// https://developers.paynow.co.zw/docs/paynow/status_update/ and
// https://developers.paynow.co.zw/docs/paynow/express_checkout_transactions/.
//
// ASSUMPTION (flagged per Phase 7 brief — see report): the *complete*
// enumeration of Paynow status strings is rendered client-side in a
// table on developers.paynow.co.zw that this environment could not
// fetch as static text. The mapping below reflects Paynow's long-
// standing, widely-documented status vocabulary (corroborated by every
// third-party SDK inspected — PHP, Dart, Python) but has NOT been
// exhaustively cross-checked against that specific table. Before this
// provider is wired into Phase 8, re-verify this list directly against
// that page (or a captured real Paynow response) and extend it if
// necessary — `mapPaynowStatus` throws on anything unrecognized rather
// than silently guessing, so a gap here fails loudly, not silently.

import type { PaymentStatus } from '../../domain/types'

export class UnrecognizedPaynowStatusError extends Error {
  constructor(rawStatus: string) {
    super(`Unrecognized Paynow status: "${rawStatus}"`)
    this.name = 'UnrecognizedPaynowStatusError'
  }
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  // Terminal / in-flight "not yet paid" states.
  created: 'PENDING',
  sent: 'PENDING',
  pending: 'PENDING',

  // Paid states. 'Awaiting Delivery' and 'Delivered' both mean Paynow
  // has received the customer's funds — the difference is purely
  // whether the merchant has since marked the order as fulfilled on
  // Paynow's side, which this app does not use. Both map to PAID.
  paid: 'PAID',
  'awaiting delivery': 'PAID',
  delivered: 'PAID',

  cancelled: 'CANCELLED',

  failed: 'FAILED',
  error: 'FAILED',
  disputed: 'FAILED',

  refunded: 'REFUNDED',
}

/** Throws `UnrecognizedPaynowStatusError` for any status string not in
 * the (documented, but not exhaustively confirmed — see file header)
 * map above, rather than guessing. */
export function mapPaynowStatus(rawStatus: string): PaymentStatus {
  const normalized = rawStatus.trim().toLowerCase()
  const mapped = STATUS_MAP[normalized]
  if (!mapped) {
    throw new UnrecognizedPaynowStatusError(rawStatus)
  }
  return mapped
}
