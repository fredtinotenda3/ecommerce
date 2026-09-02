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
//
// PHASE 13F-A — after a `payment_intent.*` event is verified and
// classified as `handled`, this route now also reconciles it against
// the native Order/Payment records `POST /api/orders/native` created
// (see StripeWebhookService.ts's `reconcileStripePaymentIntentEvent`):
// transitions Payment/Order status and, on the delivery that first
// confirms payment, clears the customer's cart. Always acknowledges a
// signature-valid event with 2xx regardless of reconciliation outcome
// (duplicate or not) — a non-2xx response makes Stripe retry
// indefinitely on what may otherwise be a fully processed, idempotent
// no-op, same rationale as the Paynow callback route.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { InvalidPaymentTransitionError } from '../../../../../lib/services/orderStateMachine'
import {
  StripeOrderNotFoundError,
  StripePaymentNotFoundError,
  StripeWebhookConfigError,
  StripeWebhookSignatureError,
} from '../../../../../lib/services/StripeWebhookService'
import { guardNativeStripeCheckoutEnabled } from '../../../../_api/nativeStripeCheckoutFlag'
import {
  processStripeWebhookEventNative,
  reconcileStripePaymentIntentEventNative,
} from '../../../../_api/stripeCheckoutNative'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeStripeCheckoutEnabled()
  if (guard) return guard

  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  try {
    const result = processStripeWebhookEventNative(rawBody, signature)

    if (!result.handled || !result.paymentIntentId) {
      return NextResponse.json({ received: true, ...result })
    }

    try {
      const reconciliation = await reconcileStripePaymentIntentEventNative(
        result.eventType,
        result.paymentIntentId,
      )
      return NextResponse.json({
        received: true,
        ...result,
        reconciled: reconciliation !== null,
        duplicate: reconciliation?.duplicate ?? false,
      })
    } catch (reconcileError: unknown) {
      if (
        reconcileError instanceof StripePaymentNotFoundError ||
        reconcileError instanceof StripeOrderNotFoundError
      ) {
        // Signature-valid, but references a Payment/Order we don't
        // recognize (e.g. the client's POST to /api/orders/native
        // hasn't landed yet, or this webhook is pointed at the wrong
        // environment's database). Logged for investigation.
        // eslint-disable-next-line no-console
        console.error('Native Stripe webhook for unknown Payment/Order:', reconcileError.message)
        return NextResponse.json({ error: 'Unknown payment' }, { status: 404 })
      }
      if (reconcileError instanceof InvalidPaymentTransitionError) {
        // Signature-valid, but reports a status transition the state
        // machine doesn't allow for wherever this Payment currently is
        // (e.g. an out-of-order/stale delivery). NOT the duplicate/
        // idempotent case — that's handled inside the reconciliation
        // function without throwing. Logged, deliberately not applied,
        // acknowledged with 200 since retrying will not change the
        // outcome.
        // eslint-disable-next-line no-console
        console.error(
          'Native Stripe webhook: invalid payment status transition:',
          reconcileError.message,
        )
        return NextResponse.json({ received: true, ignored: true }, { status: 200 })
      }
      throw reconcileError
    }
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
