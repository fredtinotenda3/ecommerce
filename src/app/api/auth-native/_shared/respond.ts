// src/app/api/auth-native/_shared/respond.ts
//
// PHASE 5 — shared helpers for the six /api/auth-native/* route
// handlers. Kept under `_shared` (leading underscore) so Next.js's App
// Router does not treat it as a route, matching the existing `_api` /
// `_components` convention used elsewhere in `src/app`.

import { NextResponse } from 'next/server'

import { AuthError, type AuthErrorCode } from '../../../../lib/services/AuthService'
import { isNativeAuthEnabled } from '../../../_api/authFlag'

/** Deliberately a DIFFERENT cookie name from Payload's `payload-token`
 * (see src/app/_api/token.ts) so the two auth systems can never collide
 * or overwrite each other's cookie while both exist side by side. */
export const NATIVE_SESSION_COOKIE = 'native-session'

/** Returns a 404 Response if native auth is disabled, or `null` if the
 * caller should proceed. 404 (not 405) is used deliberately — see the
 * Phase 5 report's rationale: when disabled, these routes should look
 * like they don't exist at all rather than confirming their presence. */
export const guardNativeAuthEnabled = (): NextResponse | null => {
  if (!isNativeAuthEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return null
}

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  EMAIL_TAKEN: 409,
  WEAK_PASSWORD: 400,
  INVALID_TOKEN: 400,
  UNAUTHENTICATED: 401,
}

/** Maps a thrown error to a JSON error response with an appropriate HTTP
 * status. `AuthError`s get a specific status + message; anything else
 * (a genuine bug, a DB error, etc.) is logged and reduced to a generic
 * 500 so internals are never leaked in the response body. */
export const errorResponse = (error: unknown): NextResponse => {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: STATUS_BY_CODE[error.code] },
    )
  }
  // eslint-disable-next-line no-console
  console.error('auth-native route error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production'

/** Sets the native session cookie on a response, following the same
 * httpOnly/secure/sameSite conventions Payload's own auth cookie uses
 * (see node_modules/payload/dist/auth/operations/resetPassword.js). */
export const setSessionCookie = (
  response: NextResponse,
  token: string,
  expiresAtSeconds: number,
): void => {
  response.cookies.set(NATIVE_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAtSeconds * 1000),
  })
}

export const clearSessionCookie = (response: NextResponse): void => {
  response.cookies.set(NATIVE_SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
