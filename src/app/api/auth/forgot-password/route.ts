// src/app/api/auth/forgot-password/route.ts
//
// POST /api/auth/forgot-password — issues a password reset token.
//
// Always responds the same way whether or not the address is registered:
// a differing response would turn this into an account-enumeration oracle.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requestPasswordReset } from '../../../_api/auth'
import { errorResponse } from '../_shared/respond'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { email } = body ?? {}

    if (typeof email !== 'string' || !email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // Result (including whether the user was found) is intentionally
    // discarded from the response — see the file header comment.
    await requestPasswordReset(email)

    return NextResponse.json({
      message: 'If an account exists for that email, a reset link has been sent.',
    })
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
