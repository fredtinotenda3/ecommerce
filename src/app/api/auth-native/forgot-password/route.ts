// src/app/api/auth-native/forgot-password/route.ts
//
// PHASE 5 — POST /api/auth-native/forgot-password. Flag-gated
// (USE_NATIVE_AUTH), not called by the frontend yet.
//
// No email-sending infrastructure is wired up in this phase (Payload's
// own forgot-password flow uses its configured `emailOptions`/nodemailer
// setup, which this deliberately does not touch or reuse — see the
// Phase 5 report's "deliberately differs" section). The reset token is
// generated and stored, but NEVER included in this route's response,
// and the response is identical whether or not the email exists, so
// this endpoint can't be used to enumerate registered accounts.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { requestPasswordResetNative } from '../../../_api/authNative'
import { errorResponse, guardNativeAuthEnabled } from '../_shared/respond'

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeAuthEnabled()
  if (guard) return guard

  try {
    const body = await request.json()
    const { email } = body ?? {}

    if (typeof email !== 'string' || !email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // Result (including whether the user was found) is intentionally
    // discarded from the response — see the file header comment.
    await requestPasswordResetNative(email)

    return NextResponse.json({
      message: 'If an account exists for that email, a reset link has been sent.',
    })
  } catch (error: unknown) {
    return errorResponse(error)
  }
}
