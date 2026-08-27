// src/app/api/auth-native/register/route.ts
//
// PHASE 5 — POST /api/auth-native/register. Flag-gated (USE_NATIVE_AUTH),
// not called by the frontend yet. See src/app/_api/authNative.ts /
// src/lib/services/AuthService.ts for the underlying implementation.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { registerNative } from '../../../_api/authNative'
import { errorResponse, guardNativeAuthEnabled, setSessionCookie } from '../_shared/respond'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeAuthEnabled()
  if (guard) return guard

  try {
    const body = await request.json()
    const { email, password, name } = body ?? {}

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { user, session } = await registerNative({
      email,
      password,
      name: typeof name === 'string' ? name : null,
    })

    const response = NextResponse.json(
      {
        message: 'Account created successfully.',
        user,
        token: session.token,
        exp: session.expiresAt,
      },
      { status: 201 },
    )
    setSessionCookie(response, session.token, session.expiresAt)
    return response
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
