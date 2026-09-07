// src/app/api/orders/route.ts
//
// GET /api/orders — the authenticated customer's own orders, newest first.
//
// The customer id comes from the session, never from a query parameter, so
// this endpoint cannot be pointed at somebody else's order history. Orders
// are not creatable here: an order only ever comes into existence as part
// of a checkout (see /api/checkout/paynow/initiate), where the server
// derives the items and prices itself.

import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '../../_api/authenticatedUser'
import { fetchCustomerOrders } from '../../_api/orders'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
  }

  try {
    const docs = await fetchCustomerOrders(user.id)
    return NextResponse.json({ docs })
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('order listing failed:', error)
    return NextResponse.json({ error: 'Unable to load orders.' }, { status: 500 })
  }
}
