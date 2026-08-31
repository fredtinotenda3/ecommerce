// src/app/api/paywall/route.ts
//
// PHASE 13A — POST /api/paywall
//
// Server-side proxy/branch point for `PaywallBlocks`
// (src/app/_components/PaywallBlocks/index.tsx), which used to call
// Payload's `/api/graphql` directly from the browser with no native
// equivalent at all (flagged in the Phase 13 readiness report as a
// blocker with "no flag and no native path"). This route exists so the
// client component can stay flag-agnostic: it always calls this same
// same-origin endpoint, and the SERVER decides whether to serve the
// response from the native repositories (`USE_NATIVE_REPOSITORY=true`)
// or by proxying Payload's existing GraphQL API (default, flag off).
//
// Response shape is deliberately identical either way — matches exactly
// what `PaywallBlocks` already expects from the `PRODUCT_PAYWALL` query:
//   { data: { Products: { docs: [{ paywall: Block[] | null }] } } }
// so the client component needs no response-shape changes, only its
// fetch target (see PaywallBlocks/index.tsx's PHASE 13A comment).
//
// Identity for the native path is resolved via
// `getAuthenticatedPayloadUser()` (../../_api/getAuthenticatedPayloadUser.ts),
// which itself already branches on `USE_NATIVE_AUTH` — so this route
// automatically follows whichever auth system is authoritative without
// needing its own copy of that logic. The GraphQL proxy path forwards
// the caller's cookies exactly as the client used to send them when
// calling `/api/graphql` directly, so Payload's own auth continues to
// work unchanged when the repository flag is off.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getDbConnection } from '../../../lib/db/connection'
import { MongoUserRepository } from '../../../lib/repositories/UserRepository'
import { isNativeRepositoryEnabled } from '../../_api/dataSource'
import type { PaywallRequestingUser } from '../../_api/fetchPaywallNative'
import { fetchPaywallNative } from '../../_api/fetchPaywallNative'
import { getAuthenticatedPayloadUser } from '../../_api/getAuthenticatedPayloadUser'
import { GRAPHQL_API_URL } from '../../_api/shared'
import { PRODUCT_PAYWALL } from '../../_graphql/products'

const NULL_PAYWALL_RESPONSE = {
  data: { Products: { docs: [{ paywall: null }] } },
}

/** Resolves the requesting user (via whichever auth system
 * `getAuthenticatedPayloadUser` currently authorizes — see that file's
 * PHASE 13A comment) into the narrow `roles`/`purchases` shape the
 * native paywall access check needs. Looks the user up in the native
 * `users` collection by id regardless of which auth system
 * authenticated them, since it's the same underlying document Payload
 * itself writes to. */
const resolvePaywallUser = async (): Promise<PaywallRequestingUser | null> => {
  const identity = await getAuthenticatedPayloadUser()
  if (!identity) return null

  const connection = await getDbConnection()
  const userRepository = new MongoUserRepository(connection)
  const nativeUser = await userRepository.getById(identity.id)
  if (!nativeUser) return null

  return { id: nativeUser.id, roles: nativeUser.roles, purchases: nativeUser.purchases }
}

export async function POST(request: NextRequest): Promise<Response> {
  let slug: string | undefined
  try {
    const body = await request.json()
    slug = typeof body?.slug === 'string' ? body.slug : undefined
  } catch {
    // handled below
  }

  if (!slug) {
    return NextResponse.json({ errors: [{ message: 'slug is required' }] }, { status: 400 })
  }

  if (isNativeRepositoryEnabled()) {
    try {
      const user = await resolvePaywallUser()
      const paywall = await fetchPaywallNative(slug, user)
      return NextResponse.json({ data: { Products: { docs: [{ paywall }] } } })
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error('native paywall fetch failed:', error)
      return NextResponse.json(NULL_PAYWALL_RESPONSE)
    }
  }

  // Default: proxy the existing Payload GraphQL request, forwarding the
  // caller's cookies exactly as the client used to send them when it
  // called `/api/graphql` directly.
  try {
    const response = await fetch(`${GRAPHQL_API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ query: PRODUCT_PAYWALL, variables: { slug } }),
      cache: 'no-store',
    })

    const json = await response.json()
    return NextResponse.json(json, { status: response.status })
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('payload paywall proxy failed:', error)
    return NextResponse.json(NULL_PAYWALL_RESPONSE)
  }
}
