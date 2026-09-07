// src/app/api/admin/_shared/respond.ts
//
// Shared plumbing for the admin write API: JSON body parsing and the one
// place a thrown error becomes an HTTP response.
//
// `AdminValidationError` carries a message written for the operator and
// the status it should produce. Anything else is a bug or an
// infrastructure failure: it is logged server-side and reduced to a
// generic 500, so internals never reach the client.

import { NextResponse } from 'next/server'

import { AdminValidationError } from '../../../_api/adminMutations'
import { MediaUploadError } from '../../../../lib/media/storage'

export const adminErrorResponse = (error: unknown): NextResponse => {
  if (error instanceof AdminValidationError || error instanceof MediaUploadError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  // A duplicate-key error means a unique index caught something the
  // service's own check raced past. It is the operator's problem to fix,
  // not a server fault.
  if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
    return NextResponse.json({ error: 'That value is already taken.' }, { status: 409 })
  }

  // eslint-disable-next-line no-console
  console.error('admin route error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

/** Parses a JSON body, or throws the 400 the route should return. */
export const readJsonBody = async (request: Request): Promise<Record<string, unknown>> => {
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new Error('not an object')
    }
    return body as Record<string, unknown>
  } catch {
    throw new AdminValidationError('Invalid request body.')
  }
}
