// src/app/api/payments/paynow/callback/route.ts
//
// POST /api/payments/paynow/callback — Paynow's `resulturl`, and the ONLY
// authoritative source of payment success. The browser return URL is
// cosmetic and never marks anything paid.
//
// The body is read as a RAW STRING and never JSON-parsed here: Paynow's
// hash is computed positionally over the exact field order it sent, and any
// intermediate parse risks losing that order and failing a legitimate
// callback. `PaynowProvider.handleCallback` parses it in an order-preserving
// way and verifies the hash before anything is trusted.
//
// Responds 200 for any well-formed, hash-valid payload — including a
// duplicate delivery, which is an idempotent no-op. A non-200 there would
// make Paynow retry indefinitely on already-processed work.
//
// No session check: the caller is Paynow's server, not a logged-in browser.
// Authenticity comes from the hash alone, never from a cookie.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { InvalidPaynowCallbackError } from '../../../../../lib/payments/PaynowProvider'
import { InvalidPaymentTransitionError } from '../../../../../lib/services/orderStateMachine'
import {
  PaynowCallbackOrderNotFoundError,
  PaynowCallbackPaymentNotFoundError,
} from '../../../../../lib/services/PaynowCallbackService'
import { processPaynowCallback } from '../../../../_api/paynowCheckout'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  // Raw body string, not JSON — see file header.
  const rawBody = await request.text()

  try {
    const { duplicate } = await processPaynowCallback(rawBody)
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
      // that's handled inside processPaynowCallback without
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
