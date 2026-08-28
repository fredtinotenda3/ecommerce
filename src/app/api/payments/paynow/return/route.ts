// src/app/api/payments/paynow/return/route.ts
//
// PHASE 8 — GET /api/payments/paynow/return?reference=<orderNumber>
//
// This is the customer's BROWSER redirect after leaving Paynow's hosted
// payment page. Per the brief's Critical Security Rule #4 ("Browser
// redirect / return URL is NOT proof of payment"), this route NEVER
// marks a Payment or Order as paid, and performs NO write of any kind —
// it only reads the order's CURRENT state (as last written by the
// callback route, the only authoritative writer — see
// ../callback/route.ts) and redirects the customer to the existing
// order-status page.
//
// That page (src/app/(pages)/orders/[id]/page.tsx) independently
// re-fetches the order from the database on every load via Payload's
// own `/api/orders/:id` (both Payload's connection and the native one
// point at the same physical `orders` collection — see
// src/lib/db/connection.ts), so whatever it shows always reflects the
// callback route's latest write, never anything decided in this file.
// If the callback has already been processed (common — Paynow typically
// delivers the callback before or around the same time as the browser
// redirect) the order page will already show PAID; if not, it shows
// whatever the order's current status actually is (still
// PENDING_PAYMENT) rather than a lie.
//
// Flag-gated (USE_PAYNOW_CHECKOUT), consistent with the other Paynow
// routes.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getOrderByOrderNumberNative } from '../../../../_api/paynowCheckout'
import { guardPaynowCheckoutEnabled } from '../../../../_api/paynowCheckoutFlag'

export async function GET(request: NextRequest): Promise<Response> {
  const guard = guardPaynowCheckoutEnabled()
  if (guard) return guard

  const reference = request.nextUrl.searchParams.get('reference')
  if (!reference) {
    return NextResponse.redirect(new URL('/cart', request.nextUrl.origin))
  }

  // READ ONLY — see file header. No status is set, transitioned, or
  // otherwise mutated here.
  const order = await getOrderByOrderNumberNative(reference)
  if (!order) {
    return NextResponse.redirect(new URL('/cart', request.nextUrl.origin))
  }

  return NextResponse.redirect(new URL(`/orders/${order.id}`, request.nextUrl.origin))
}
