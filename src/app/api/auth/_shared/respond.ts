// src/app/api/auth/_shared/respond.ts
//
// Shared helpers for the six /api/auth/* route handlers. Kept under
// `_shared` (leading underscore) so the App Router does not treat it as a
// route, matching the `_api`/`_components` convention used elsewhere.

import { NextResponse } from 'next/server'

import { AuthError, type AuthErrorCode } from '../../../../lib/services/AuthService'

/** Name of the httpOnly cookie carrying the signed session token. */
export const SESSION_COOKIE = 'native-session'

const STATUS_BY_CODE: Record<AuthErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  EMAIL_TAKEN: 409,
  WEAK_PASSWORD: 400,
  INVALID_TOKEN: 400,
  UNAUTHENTICATED: 401,
}

/** Maps a thrown error to a JSON response. `AuthError`s carry a safe,
 * user-facing message and a specific status; anything else is a bug or an
 * infrastructure failure, so it is logged server-side and reduced to a
 * generic 500 — internals are never echoed to the client. */
export const errorResponse = (error: unknown): NextResponse => {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: STATUS_BY_CODE[error.code] },
    )
  }
  // eslint-disable-next-line no-console
  console.error('auth route error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

const isProduction = (): boolean => process.env.NODE_ENV === 'production'

/** httpOnly so script cannot read it, `secure` in production so it is
 * never sent over plaintext, and `sameSite: lax` so it is not attached to
 * cross-site form posts (the CSRF concern for the state-changing routes
 * that read it). */
export const setSessionCookie = (
  response: NextResponse,
  token: string,
  expiresAtSeconds: number,
): void => {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAtSeconds * 1000),
  })
}

export const clearSessionCookie = (response: NextResponse): void => {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}
