// src/app/api/auth/register/route.ts
//
// POST /api/auth/register — creates a customer account and issues a session
// in the same request. New accounts always get the `customer` role; the role
// is never read from the request body.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { registerUser } from '../../../_api/auth'
import { errorResponse, setSessionCookie } from '../_shared/respond'

/** Reads request state (cookies/headers) — never statically rendered. */
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json()
    const { email, password, name } = body ?? {}

    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'email and password are required' }, { status: 400 })
    }

    const { user, session } = await registerUser({
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
