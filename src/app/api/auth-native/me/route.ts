// src/app/api/auth-native/me/route.ts
//
// PHASE 5 — GET /api/auth-native/me. Flag-gated (USE_NATIVE_AUTH), not
// called by the frontend yet. Reads the session from the `native-session`
// cookie by default, and also accepts `Authorization: Bearer <token>` as
// an alternative (per the task's "or an Authorization: Bearer token for
// simplicity" note) — useful for testing this route without a browser.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getCurrentUserNative } from '../../../_api/authNative'
import { errorResponse, guardNativeAuthEnabled, NATIVE_SESSION_COOKIE } from '../_shared/respond'

const extractToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  return request.cookies.get(NATIVE_SESSION_COOKIE)?.value ?? null
}

export async function GET(request: NextRequest): Promise<Response> {
  const guard = guardNativeAuthEnabled()
  if (guard) return guard

  try {
    const token = extractToken(request)
    const user = await getCurrentUserNative(token)
    return NextResponse.json({ user })
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
