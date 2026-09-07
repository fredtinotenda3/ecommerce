// src/app/api/auth/login/route.ts
//
// POST /api/auth/login — verifies the password against the hash/salt on
// the user document and issues a session cookie. The stored hash format is
// PBKDF2 at the same parameters the previous CMS used, so accounts created
// before the migration continue to log in with their existing passwords.
//
// Repeated failures lock the account (see AuthService.MAX_LOGIN_ATTEMPTS),
// and an unknown email and a wrong password return the same error, so this
// route cannot be used to enumerate registered addresses.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { loginUser } from '../../../_api/auth'
import { errorResponse, setSessionCookie } from '../_shared/respond'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { email, password } = body ?? {}

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { user, session } = await loginUser({ email, password })

    const response = NextResponse.json({
      message: 'Logged in successfully.',
      user,
      token: session.token,
      exp: session.expiresAt,
    })
    setSessionCookie(response, session.token, session.expiresAt)
    return response
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
