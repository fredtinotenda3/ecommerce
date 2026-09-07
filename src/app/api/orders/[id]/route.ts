// src/app/api/orders/[id]/route.ts
//
// GET /api/orders/:id — one of the authenticated customer's own orders.
//
// An order belonging to another customer returns 404, not 403: a
// distinguishable response would let a caller probe which order ids exist.

import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '../../../_api/authenticatedUser'
import { fetchCustomerOrder } from '../../../_api/orders'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
  }

  try {
    const order = await fetchCustomerOrder(params.id, user.id)
    if (!order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(order)
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('order fetch failed:', error)
    return NextResponse.json({ error: 'Unable to load order.' }, { status: 500 })
  }
}
