// src/app/api/auth-native/reset-password/route.ts
//
// PHASE 5 — POST /api/auth-native/reset-password. Flag-gated
// (USE_NATIVE_AUTH), not called by the frontend yet. On success,
// immediately issues a new native session (matching Payload's own
// resetPassword.js, which also logs the user in after a successful
// reset) and sets the native-session cookie.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { resetPasswordNative } from '../../../_api/authNative'
import { errorResponse, guardNativeAuthEnabled, setSessionCookie } from '../_shared/respond'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeAuthEnabled()
  if (guard) return guard

  try {
    const body = await request.json()
    const { token, password } = body ?? {}

    if (typeof token !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'token and password are required' }, { status: 400 })
    }

    const { user, session } = await resetPasswordNative({ token, newPassword: password })

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
