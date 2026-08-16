// src/lib/auth/session.ts
//
// Foundation only — NOT wired into any route in this phase. Defines the
// shape a native session token would take (HMAC-signed, JSON payload,
// base64url-encoded) so that when native auth is actually activated
// (a later phase), the mechanism already exists and has tests.
//
// Requires SESSION_SECRET to be set once this is actually used; reading
// it lazily (inside the functions, not at module load) so importing this
// module in a context where SESSION_SECRET isn't set yet (e.g. right now,
// since nothing calls this) doesn't throw.

import { createHmac, timingSafeEqual } from 'crypto'

export interface SessionPayload {
  userId: string
  roles: string[]
  issuedAt: number
  expiresAt: number
}

const getSecret = (): string => {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      'SESSION_SECRET is not set. This is required before native session tokens can be ' +
        'issued or verified — not required for Phase 1, which does not call this yet.',
    )
  }
  return secret
}

const base64url = (input: Buffer | string): string => Buffer.from(input).toString('base64url')

const fromBase64url = (input: string): Buffer => Buffer.from(input, 'base64url')

const sign = (data: string): string =>
  createHmac('sha256', getSecret()).update(data).digest('base64url')

export const createSessionToken = (
  payload: Omit<SessionPayload, 'issuedAt' | 'expiresAt'>,
  ttlSeconds = 60 * 60 * 24 * 7, // 7 days
): string => {
  const now = Math.floor(Date.now() / 1000)
  const fullPayload: SessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + ttlSeconds,
  }
  const encodedPayload = base64url(JSON.stringify(fullPayload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export class InvalidSessionTokenError extends Error {
  constructor(reason: string) {
    super(`Invalid session token: ${reason}`)
    this.name = 'InvalidSessionTokenError'
  }
}

export const verifySessionToken = (token: string): SessionPayload => {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    throw new InvalidSessionTokenError('malformed token')
  }

  const expectedSignature = sign(encodedPayload)
  const a = Buffer.from(signature)
  const b = Buffer.from(expectedSignature)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new InvalidSessionTokenError('signature mismatch')
  }

  let payload: SessionPayload
  try {
    payload = JSON.parse(fromBase64url(encodedPayload).toString('utf8'))
  } catch {
    throw new InvalidSessionTokenError('unparseable payload')
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload.expiresAt < now) {
    throw new InvalidSessionTokenError('expired')
  }

  return payload
}
