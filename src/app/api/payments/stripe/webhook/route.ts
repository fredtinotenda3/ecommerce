// src/app/api/payments/stripe/webhook/route.ts
//
// PHASE 13E — POST /api/payments/stripe/webhook
//
// Flag-gated (USE_NATIVE_STRIPE_CHECKOUT — see
// ../../../../_api/nativeStripeCheckoutFlag.ts). Native replacement for
// the `@payloadcms/plugin-stripe` webhook registration in
// src/payload/payload.config.ts (`productUpdated`/`priceUpdated`),
// reachable only when the flag is on. The legacy Payload-driven webhook
// path is completely unaffected and remains the default; Stripe's
// dashboard webhook configuration would need to point at this URL
// instead to actually route events here — this phase adds the endpoint,
// it does not change what's registered with Stripe.
//
// See StripeWebhookService.ts's file header for why this does NOT
// reproduce the legacy handlers' product/price catalog sync.
//
// Reads the raw request body (required for Stripe signature
// verification — a parsed/re-serialized body will not match the
// signature) via `request.text()`, matching Stripe's own documented
// webhook-handling guidance.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  StripeWebhookConfigError,
  StripeWebhookSignatureError,
} from '../../../../../lib/services/StripeWebhookService'
import { guardNativeStripeCheckoutEnabled } from '../../../../_api/nativeStripeCheckoutFlag'
import { processStripeWebhookEventNative } from '../../../../_api/stripeCheckoutNative'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeStripeCheckoutEnabled()
  if (guard) return guard

  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  try {
    const result = processStripeWebhookEventNative(rawBody, signature)
    return NextResponse.json({ received: true, ...result })
  } catch (error: unknown) {
    if (error instanceof StripeWebhookSignatureError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof StripeWebhookConfigError) {
      // eslint-disable-next-line no-console
      console.error('Native Stripe webhook misconfigured:', error.message)
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    // eslint-disable-next-line no-console
    console.error('Native Stripe webhook error:', message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
