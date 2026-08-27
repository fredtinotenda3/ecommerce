// src/app/api/auth-native/logout/route.ts
//
// PHASE 5 — POST /api/auth-native/logout. Flag-gated (USE_NATIVE_AUTH),
// not called by the frontend yet. Native sessions are stateless HMAC
// tokens with no server-side revocation store in this phase (see
// AuthService.ts's `logout` doc comment) — this clears the cookie, which
// is the only thing a stateless-token "logout" can meaningfully do
// without a revocation store.

import { NextResponse } from 'next/server'

import { logoutNative } from '../../../_api/authNative'
import { clearSessionCookie, errorResponse, guardNativeAuthEnabled } from '../_shared/respond'

export async function POST(): Promise<Response> {
  const guard = guardNativeAuthEnabled()
  if (guard) return guard

  try {
    await logoutNative()
    const response = NextResponse.json({ message: 'Logged out successfully.' })
    clearSessionCookie(response)
    return response
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
