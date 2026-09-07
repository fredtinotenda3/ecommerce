// src/app/api/payments/paynow/return/route.ts
//
// GET /api/payments/paynow/return?reference=<orderNumber>
//
// The customer's BROWSER redirect back from Paynow's hosted payment page.
// A browser redirect is not proof of payment: anyone can request this URL
// with any reference. This route therefore performs NO write of any kind —
// it reads the order's current state (as last written by the callback
// route, the only authoritative writer) and redirects to the order page.
//
// The order page re-reads the order on every load, so it always shows what
// the callback has actually recorded rather than anything decided here. If
// the callback has not arrived yet the order still reads as pending, which
// is the truth.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getOrderByOrderNumber } from '../../../../_api/paynowCheckout'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const reference = request.nextUrl.searchParams.get('reference')
  if (!reference) {
    return NextResponse.redirect(new URL('/cart', request.nextUrl.origin))
  }

  // READ ONLY — see file header. No status is set, transitioned, or
  // otherwise mutated here.
  const order = await getOrderByOrderNumber(reference)
  if (!order) {
    return NextResponse.redirect(new URL('/cart', request.nextUrl.origin))
  }

  return NextResponse.redirect(new URL(`/orders/${order.id}`, request.nextUrl.origin))
}
