// src/app/api/auth/logout/route.ts
//
// POST /api/auth/logout — clears the session cookie. Always succeeds: a
// caller with no session is already logged out.

import { NextResponse } from 'next/server'

import { logoutUser } from '../../../_api/auth'
import { clearSessionCookie, errorResponse } from '../_shared/respond'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function POST(): Promise<Response> {
  try {
    await logoutUser()
    const response = NextResponse.json({ message: 'Logged out successfully.' })
    clearSessionCookie(response)
    return response
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
