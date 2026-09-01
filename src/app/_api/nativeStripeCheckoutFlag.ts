// src/app/_api/nativeStripeCheckoutFlag.ts
//
// PHASE 13E flag: gates the new, native (non-Payload) Stripe checkout
// routes (`/api/checkout/stripe/create-payment-intent`,
// `/api/payments/stripe/webhook`).
//
// Separate from `USE_NATIVE_REPOSITORY`, `USE_NATIVE_AUTH`,
// `USE_NATIVE_ADMIN`, `USE_PAYNOW_CHECKOUT`, and `USE_NATIVE_SERVER` —
// same rationale as paynowCheckoutFlag.ts: a deployment could have any
// combination of these on/off independently. Native Stripe checkout does
// NOT require native auth: it authenticates via the same
// `getAuthenticatedPayloadUser()` helper the Paynow checkout route
// already uses (payload-token cookie by default, native-session cookie
// when USE_NATIVE_AUTH is also on) — introducing no new auth mechanism.
//
// Default (flag unset/false): every `/api/checkout/stripe/*` and
// `/api/payments/stripe/*` route responds 404, as if it doesn't exist —
// same "look like it doesn't exist" rationale as native auth/Paynow. The
// existing Stripe checkout (`/api/create-payment-intent`, Payload's
// `@payloadcms/plugin-stripe` webhooks, the `/checkout` page's default
// render) is completely unaffected either way, and remains the only
// active Stripe path when this flag is off.

import { NextResponse } from 'next/server'

export const isNativeStripeCheckoutEnabled = (): boolean =>
  process.env.USE_NATIVE_STRIPE_CHECKOUT === 'true'

/** Returns a 404 Response if the native Stripe checkout flag is
 * disabled, or `null` if the caller should proceed. Call this first
 * thing in every `/api/checkout/stripe/*` and `/api/payments/stripe/*`
 * route handler. */
export const guardNativeStripeCheckoutEnabled = (): NextResponse | null => {
  if (!isNativeStripeCheckoutEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}
