// src/app/api/auth/reset-password/route.ts
//
// POST /api/auth/reset-password — consumes a reset token, sets the new
// password and issues a session. The token is single-use and expires; both
// checks live in AuthService, not here.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { resetPasswordForToken } from '../../../_api/auth'
import { errorResponse, setSessionCookie } from '../_shared/respond'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { token, password } = body ?? {}

    if (typeof token !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    const { user, session } = await resetPasswordForToken({ token, newPassword: password })

    const response = NextResponse.json({
      message: 'Password reset successfully.',
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
