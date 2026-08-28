// src/app/_api/paynowCheckoutFlag.ts
//
// PHASE 8 flag: gates the new, flag-gated Paynow checkout/payment
// routes (`/api/checkout/paynow/*`, `/api/payments/paynow/*`).
//
// Separate from `USE_NATIVE_REPOSITORY` (dataSource.ts), `USE_NATIVE_AUTH`
// (authFlag.ts), and `USE_NATIVE_ADMIN` (adminFlag.ts) — a deployment
// could have any combination of those on/off independently of whether
// the Paynow checkout path is exposed. Paynow checkout does NOT require
// native auth: it authenticates via Payload's existing `payload-token`
// cookie, same as the current Stripe checkout (see
// getAuthenticatedPayloadUser.ts) — introducing no new auth mechanism.
//
// Default (flag unset/false): every `/api/checkout/paynow/*` and
// `/api/payments/paynow/*` route responds 404, as if it doesn't exist —
// same "look like it doesn't exist" rationale as native auth (Phase 5
// report). The existing Stripe checkout (`/api/create-payment-intent`,
// the `/checkout` page) is completely unaffected either way, and remains
// the only active checkout path when this flag is off.
//
// Deliberately a single tiny helper (not a config object), same
// rationale as isNativeRepositoryEnabled/isNativeAuthEnabled/isNativeAdminEnabled.

import { NextResponse } from 'next/server'

export const isPaynowCheckoutEnabled = (): boolean => process.env.USE_PAYNOW_CHECKOUT === 'true'

/** Returns a 404 Response if the Paynow checkout flag is disabled, or
 * `null` if the caller should proceed. Call this first thing in every
 * `/api/checkout/paynow/*` and `/api/payments/paynow/*` route handler. */
export const guardPaynowCheckoutEnabled = (): NextResponse | null => {
  if (!isPaynowCheckoutEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}
