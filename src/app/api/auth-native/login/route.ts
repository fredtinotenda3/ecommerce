// src/app/api/auth-native/login/route.ts
//
// PHASE 5 — POST /api/auth-native/login. Flag-gated (USE_NATIVE_AUTH),
// not called by the frontend yet. Verifies against whatever
// hash/salt is already on the user document — works for existing
// Payload-created users AND users registered via /api/auth-native/register.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { loginNative } from '../../../_api/authNative'
import { errorResponse, guardNativeAuthEnabled, setSessionCookie } from '../_shared/respond'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeAuthEnabled()
  if (guard) return guard

  try {
    const body = await request.json()
    const { email, password } = body ?? {}

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { user, session } = await loginNative({ email, password })

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
