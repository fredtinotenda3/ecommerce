// src/app/_api/getAuthenticatedPayloadUser.ts
//
// PHASE 8 — resolves the current user for a Route Handler (not a Server
// Component) using Payload's EXISTING `payload-token` JWT cookie — the
// same cookie/auth mechanism `getMeUser.ts` / `getMe.ts` already use for
// server components, and the same one the current Stripe checkout
// implicitly relies on via Payload's own request lifecycle (see
// src/payload/endpoints/create-payment-intent.ts's `req.user`).
//
// No new auth mechanism is introduced here for the default (flag-off)
// path. This intentionally does NOT verify the JWT locally (which would
// duplicate/diverge from Payload's own auth logic) — it delegates
// identity verification to Payload's own `/api/users/me` endpoint,
// exactly like getMeUser.ts does, just without the `redirect()` calls
// (which only work inside Server Components / Server Actions, not Route
// Handlers).
//
// PHASE 13A: when `USE_NATIVE_AUTH=true`, this now resolves identity via
// the native session (`native-session` cookie + AuthService) instead —
// see meNative.ts's `getAuthenticatedNativeUser`. The Phase 8 Paynow
// checkout route (src/app/api/checkout/paynow/initiate/route.ts) calls
// this function and needs no changes itself to pick up native auth; it
// only ever consumed the narrow `{ id, email }` shape this function
// already returned, which is unchanged. Note this is a hard switch, not
// a fallback: with the flag on, ONLY a valid native-session cookie
// authenticates a request here, matching the Phase 13a task's
// instruction to make native auth actually drive identity resolution —
// see docs/PHASE13A_REPORT.md's "Remaining Blockers" for what this
// implies while the frontend `AuthProvider` still only ever issues
// Payload's own `payload-token` cookie.

import { cookies } from 'next/headers'

import { NATIVE_SESSION_COOKIE } from '../api/auth-native/_shared/respond'
import { isNativeAuthEnabled } from './authFlag'
import { getAuthenticatedNativeUser } from './meNative'
import { GRAPHQL_API_URL } from './shared'
import { payloadToken } from './token'

export interface AuthenticatedPayloadUser {
  id: string
  email: string
}

/** Returns the authenticated user (id + email only — this deliberately
 * does not return the full user document, so callers can't accidentally
 * use anything about the user's cart/purchases from a source other than
 * the database) for the current request, or `null` if there is no valid
 * session. Never throws for "not logged in" — callers decide how to
 * respond (typically 401). */
export const getAuthenticatedPayloadUser = async (): Promise<AuthenticatedPayloadUser | null> => {
  if (isNativeAuthEnabled()) {
    const token = cookies().get(NATIVE_SESSION_COOKIE)?.value
    return getAuthenticatedNativeUser(token ?? null)
  }

  const token = cookies().get(payloadToken)?.value
  if (!token) return null

  let response: Response
  try {
    response = await fetch(`${GRAPHQL_API_URL}/api/users/me`, {
      headers: {
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })
  } catch {
    return null
  }

  if (!response.ok) return null

  const json = await response.json().catch(() => null)
  const user = json?.user
  if (!user?.id || typeof user.email !== 'string') return null

  return { id: String(user.id), email: user.email }
}
