// tests/auth.test.ts
import { beforeAll, describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../src/lib/auth/password'
import {
  createSessionToken,
  InvalidSessionTokenError,
  verifySessionToken,
} from '../src/lib/auth/session'
import { assertHasRole, hasAnyRole, isAdmin, isCustomer } from '../src/lib/auth/roles'

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same-password-123')
    const b = await hashPassword('same-password-123')
    expect(a).not.toBe(b)
  })

  it('rejects passwords under 8 characters', async () => {
    await expect(hashPassword('short')).rejects.toThrow()
  })

  it('never throws on a malformed stored hash, just returns false', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false)
  })
})

describe('session tokens', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret-not-for-production'
  })

  it('creates and verifies a valid token', () => {
    const token = createSessionToken({ userId: 'u1', roles: ['customer'] })
    const payload = verifySessionToken(token)
    expect(payload.userId).toBe('u1')
    expect(payload.roles).toEqual(['customer'])
  })

  it('rejects a tampered token', () => {
    const token = createSessionToken({ userId: 'u1', roles: ['customer'] })
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')
    expect(() => verifySessionToken(tampered)).toThrow(InvalidSessionTokenError)
  })

  it('rejects an expired token', () => {
    const token = createSessionToken({ userId: 'u1', roles: ['customer'] }, -1)
    expect(() => verifySessionToken(token)).toThrow(InvalidSessionTokenError)
  })

  it('rejects a malformed token', () => {
    expect(() => verifySessionToken('not-a-real-token')).toThrow(InvalidSessionTokenError)
  })
})

describe('roles', () => {
  it('identifies admin and customer roles', () => {
    expect(isAdmin(['admin'])).toBe(true)
    expect(isAdmin(['customer'])).toBe(false)
    expect(isCustomer(['customer'])).toBe(true)
  })

  it('hasAnyRole matches on overlap', () => {
    expect(hasAnyRole(['customer'], ['admin', 'customer'])).toBe(true)
    expect(hasAnyRole(['customer'], ['admin'])).toBe(false)
  })

  it('assertHasRole throws when the role is missing', () => {
    expect(() => assertHasRole(['customer'], ['admin'])).toThrow()
    expect(() => assertHasRole(['admin'], ['admin'])).not.toThrow()
  })
})
