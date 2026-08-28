// src/app/api/payments/paynow/callback/route.ts
//
// PHASE 8 — POST /api/payments/paynow/callback
//
// This is Paynow's `resulturl` — the ONLY authoritative source of
// payment success (see the brief's Critical Security Rules #4 and #5:
// a browser redirect is not proof of payment, this callback is). The
// GET .../return route is cosmetic only and must never mark anything
// paid — see that route's header comment.
//
// Reads the request body as a RAW STRING via `request.text()`,
// deliberately never JSON-parsed. Paynow's hash validation is
// positional over the EXACT field order Paynow sent the fields in (see
// PaynowProvider.ts / paynowSignature.ts) — parsing into an object
// first risks losing that order (e.g. via a body parser, a spread, or a
// Map), which would make a legitimate callback fail hash verification.
// The raw string is handed straight to PaynowProvider.handleCallback
// (via processPaynowCallbackNative), which parses it internally in a
// way that preserves order.
//
// Always responds 200 for a payload that is well-formed and
// hash-valid — REGARDLESS of whether it turned out to be a duplicate
// delivery — per the brief's "duplicate callback must return 200
// without side effects" requirement. A non-200 response here would
// make Paynow retry indefinitely on what is otherwise a fully
// processed, idempotent no-op.
//
// Flag-gated (USE_PAYNOW_CHECKOUT). No end-user auth check: this route
// is called by Paynow's servers, not a logged-in browser session —
// authenticity is established entirely by the hash, never by a cookie
// or session.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { InvalidPaynowCallbackError } from '../../../../../lib/payments/PaynowProvider'
import { InvalidPaymentTransitionError } from '../../../../../lib/services/orderStateMachine'
import {
  PaynowCallbackOrderNotFoundError,
  PaynowCallbackPaymentNotFoundError,
} from '../../../../../lib/services/PaynowCallbackService'
import { processPaynowCallbackNative } from '../../../../_api/paynowCheckout'
import { guardPaynowCheckoutEnabled } from '../../../../_api/paynowCheckoutFlag'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardPaynowCheckoutEnabled()
  if (guard) return guard

  // Raw body string, not JSON — see file header.
  const rawBody = await request.text()

  try {
    const { duplicate } = await processPaynowCallbackNative(rawBody)
    return NextResponse.json({ received: true, duplicate }, { status: 200 })
  } catch (error: unknown) {
    if (error instanceof InvalidPaynowCallbackError) {
      // Hash validation failed — never trust this payload's status.
      // eslint-disable-next-line no-console
      console.error('Paynow callback failed hash/field validation:', error.message)
      return NextResponse.json({ error: 'Invalid callback' }, { status: 400 })
    }
    if (
      error instanceof PaynowCallbackPaymentNotFoundError ||
      error instanceof PaynowCallbackOrderNotFoundError
    ) {
      // Hash-valid, but references a Payment/Order we don't recognize
      // (e.g. a callback for an environment/database that doesn't match
      // this one). Logged for investigation; nothing to retry into.
      // eslint-disable-next-line no-console
      console.error('Paynow callback for unknown Payment/Order:', error.message)
      return NextResponse.json({ error: 'Unknown payment' }, { status: 404 })
    }
    if (error instanceof InvalidPaymentTransitionError) {
      // Hash-valid, but reports a status transition the state machine
      // doesn't allow for wherever this Payment currently is (e.g. an
      // out-of-order/stale delivery arriving after a later status was
      // already recorded). This is NOT the duplicate/idempotent case —
      // that's handled inside processPaynowCallbackNative without
      // throwing. Logged, deliberately not applied, and acknowledged
      // with 200 since retrying will not change the outcome.
      // eslint-disable-next-line no-console
      console.error('Paynow callback: invalid payment status transition:', error.message)
      return NextResponse.json({ received: true, ignored: true }, { status: 200 })
    }
    // eslint-disable-next-line no-console
    console.error('Paynow callback route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
