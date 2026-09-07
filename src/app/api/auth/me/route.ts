// src/app/api/auth/me/route.ts
//
// GET /api/auth/me — the current user for the session, or 401. Reads the
// `native-session` cookie, and also accepts `Authorization: Bearer <token>`
// so the API can be exercised without a browser.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '../../../_api/auth'
import { errorResponse, SESSION_COOKIE } from '../_shared/respond'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

const extractToken = (request: NextRequest): string | null => {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  return request.cookies.get(SESSION_COOKIE)?.value ?? null
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const token = extractToken(request)
    const user = await getCurrentUser(token)
    return NextResponse.json({ user })
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
