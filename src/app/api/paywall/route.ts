// src/app/api/paywall/route.ts
//
// POST /api/paywall — resolves a product's paywalled blocks for the
// authenticated caller.
//
// The authorization decision lives in `canReadPaywall`
// (src/app/_api/fetchPaywall.ts) and is made server-side against the user's
// purchases read fresh from the database. The response never distinguishes
// "not purchased" from "no such product": both return null blocks.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getAuthenticatedUser } from '../../_api/authenticatedUser'
import type { PaywallRequestingUser } from '../../_api/fetchPaywall'
import { fetchPaywall } from '../../_api/fetchPaywall'
import { getRepositories } from '../../_api/repositories'

const NULL_PAYWALL_RESPONSE = { paywall: null }

const resolvePaywallUser = async (): Promise<PaywallRequestingUser | null> => {
  const identity = await getAuthenticatedUser()
  if (!identity) return null

  const { users } = await getRepositories()
  const user = await users.getById(identity.id)
  if (!user) return null

  return { id: user.id, roles: user.roles, purchases: user.purchases }
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  let slug: string | undefined
  try {
    const body = await request.json()
    slug = typeof body?.slug === 'string' ? body.slug : undefined
  } catch {
    // handled below
  }

  if (!slug) {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  try {
    const user = await resolvePaywallUser()
    const paywall = await fetchPaywall(slug, user)
    return NextResponse.json({ paywall })
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('paywall fetch failed:', error)
    return NextResponse.json(NULL_PAYWALL_RESPONSE)
  }
}
