// src/app/api/checkout/stripe/create-payment-intent/route.ts
//
// PHASE 13E — POST /api/checkout/stripe/create-payment-intent
//
// Flag-gated (USE_NATIVE_STRIPE_CHECKOUT — see
// ../../../../_api/nativeStripeCheckoutFlag.ts). Native replacement for
// src/payload/endpoints/create-payment-intent.ts, reachable only when
// the flag is on — the legacy Payload endpoint at
// `/api/create-payment-intent` is completely unaffected and remains the
// default. Requires an authenticated user via the EXISTING
// `getAuthenticatedPayloadUser()` helper (Phase 8) — no new auth
// mechanism.
//
// SECURITY: same guarantee as the Paynow initiate route — this route
// never reads a price/total/cart-contents from the request body. Cart
// items are always read fresh from the database for the authenticated
// customer, and the amount charged is always re-derived server-side
// from current Product records (see StripeCheckoutService.ts /
// CartService.validateCart). A tampered request body cannot influence
// what gets charged.

import { NextResponse } from 'next/server'

import {
  StripeCartUnavailableError,
  StripeEmptyCartError,
} from '../../../../../lib/services/StripeCheckoutService'
import { getAuthenticatedPayloadUser } from '../../../../_api/getAuthenticatedPayloadUser'
import { guardNativeStripeCheckoutEnabled } from '../../../../_api/nativeStripeCheckoutFlag'
import { createStripePaymentIntentNative } from '../../../../_api/stripeCheckoutNative'

export async function POST(): Promise<Response> {
  const guard = guardNativeStripeCheckoutEnabled()
  if (guard) return guard

  const user = await getAuthenticatedPayloadUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await createStripePaymentIntentNative({
      customerId: user.id,
      customerEmail: user.email,
    })

    // Same response field name (`client_secret`) as the legacy Payload
    // endpoint, so CheckoutPage's client-side handling needs no change
    // beyond which URL it calls.
    return NextResponse.json({ client_secret: result.clientSecret })
  } catch (error: unknown) {
    if (error instanceof StripeEmptyCartError) {
      return NextResponse.json(
        { error: 'There is nothing to pay for, add some items to your cart and try again.' },
        { status: 400 },
      )
    }
    if (error instanceof StripeCartUnavailableError) {
      return NextResponse.json(
        { error: 'There are no items in your cart to checkout with' },
        { status: 404 },
      )
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    // eslint-disable-next-line no-console
    console.error('Native Stripe create-payment-intent error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
