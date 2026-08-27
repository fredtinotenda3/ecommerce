// tests/AuthService.test.ts
//
// Unit tests for the native auth orchestration layer
// (src/lib/services/AuthService.ts), using FakeAuthUserRepository so no
// database is required — same pattern as fetchPageNative.test.ts etc.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { hashPasswordPayloadCompatible } from '../src/lib/auth/password'
import { verifySessionToken } from '../src/lib/auth/session'
import {
  AuthError,
  getCurrentUser,
  LOCK_TIME_MS,
  login,
  logout,
  MAX_LOGIN_ATTEMPTS,
  register,
  requestPasswordReset,
  requireRole,
  resetPassword,
} from '../src/lib/services/AuthService'
import { FakeAuthUserRepository } from './fakes/FakeAuthUserRepository'

describe('AuthService', () => {
  let userRepository: FakeAuthUserRepository

  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret-not-for-production'
  })

  beforeEach(() => {
    userRepository = new FakeAuthUserRepository()
  })

  describe('register', () => {
    it('creates a user with a Payload-compatible hash and returns a session', async () => {
      const result = await register(
        { email: 'New.User@Example.com', password: 'a-strong-password', name: 'New User' },
        { userRepository },
      )

      expect(result.user.email).toBe('new.user@example.com')
      expect(result.user.name).toBe('New User')
      expect(result.user.roles).toEqual(['customer'])
      expect(result.session.token).toEqual(expect.any(String))

      const stored = await userRepository.getByEmail('new.user@example.com')
      expect(stored?.hash).toEqual(expect.any(String))
      expect(stored?.salt).toEqual(expect.any(String))
      // Never returned in the sanitized user shape.
      expect('hash' in result.user).toBe(false)
      expect('salt' in result.user).toBe(false)
    })

    it('rejects a password under MIN_NATIVE_PASSWORD_LENGTH characters', async () => {
      await expect(
        register({ email: 'short@example.com', password: 'short' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' })
    })

    it('rejects registering an email that already exists', async () => {
      await register({ email: 'dupe@example.com', password: 'a-strong-password' }, { userRepository })

      await expect(
        register({ email: 'dupe@example.com', password: 'another-strong-pw' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' })
    })

    it('the registered password can immediately be verified by login', async () => {
      await register({ email: 'roundtrip@example.com', password: 'roundtrip-pw-123' }, { userRepository })
      const result = await login(
        { email: 'roundtrip@example.com', password: 'roundtrip-pw-123' },
        { userRepository },
      )
      expect(result.user.email).toBe('roundtrip@example.com')
    })
  })

  describe('login', () => {
    it('logs in an existing (Payload-created) user via its stored hash/salt', async () => {
      const { hash, salt } = await hashPasswordPayloadCompatible('existing-password')
      userRepository.seed({ email: 'existing@example.com', hash, salt, roles: ['customer'] })

      const result = await login(
        { email: 'existing@example.com', password: 'existing-password' },
        { userRepository },
      )
      expect(result.user.email).toBe('existing@example.com')
      expect(result.session.token).toEqual(expect.any(String))
    })

    it('rejects an unknown email with a generic INVALID_CREDENTIALS error', async () => {
      await expect(
        login({ email: 'nobody@example.com', password: 'whatever123' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    })

    it('rejects the wrong password with the SAME generic error as an unknown email', async () => {
      const { hash, salt } = await hashPasswordPayloadCompatible('right-password')
      userRepository.seed({ email: 'wrongpw@example.com', hash, salt })

      await expect(
        login({ email: 'wrongpw@example.com', password: 'wrong-password' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    })

    it(
      'locks the account after MAX_LOGIN_ATTEMPTS consecutive failures',
      async () => {
        const { hash, salt } = await hashPasswordPayloadCompatible('correct-password')
        const user = userRepository.seed({ email: 'lockout@example.com', hash, salt })

        for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
          await expect(
            login({ email: 'lockout@example.com', password: 'wrong' }, { userRepository }),
          ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
        }

        const locked = await userRepository.getById(user.id)
        expect(locked?.lockUntil).not.toBeNull()
        expect(locked?.lockUntil!.getTime()).toBeGreaterThan(Date.now())
        expect(locked?.lockUntil!.getTime()).toBeLessThanOrEqual(Date.now() + LOCK_TIME_MS)

        // Even the CORRECT password is rejected while locked.
        await expect(
          login({ email: 'lockout@example.com', password: 'correct-password' }, { userRepository }),
        ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' })
      },
      // This test performs MAX_LOGIN_ATTEMPTS + 2 real PBKDF2 verifications
      // (25,000 iterations each, matching Payload's own algorithm exactly —
      // see src/lib/auth/password.ts). That's deliberately not mocked or
      // reduced, since the whole point of this test is to exercise the real
      // production hashing path under repeated failed logins. Vitest's
      // default 5000ms per-test timeout isn't enough for that many real
      // PBKDF2 rounds, so this single test gets a longer, explicit budget
      // instead of changing anything about production password hashing.
      15000,
    )

    it('resets loginAttempts back to 0 after a successful login', async () => {
      const { hash, salt } = await hashPasswordPayloadCompatible('correct-password')
      const user = userRepository.seed({
        email: 'recovers@example.com',
        hash,
        salt,
        loginAttempts: MAX_LOGIN_ATTEMPTS - 1,
      })

      await login({ email: 'recovers@example.com', password: 'correct-password' }, { userRepository })

      const refreshed = await userRepository.getById(user.id)
      expect(refreshed?.loginAttempts).toBe(0)
    })
  })

  describe('getCurrentUser ("me")', () => {
    it('returns the correct user for a valid session token', async () => {
      const { user, session } = await register(
        { email: 'me@example.com', password: 'a-strong-password' },
        { userRepository },
      )

      const current = await getCurrentUser(session.token, { userRepository })
      expect(current.id).toBe(user.id)
      expect(current.email).toBe('me@example.com')
    })

    it('throws UNAUTHENTICATED for a missing token', async () => {
      await expect(getCurrentUser(null, { userRepository })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      })
      await expect(getCurrentUser(undefined, { userRepository })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      })
    })

    it('throws UNAUTHENTICATED for a malformed/tampered token', async () => {
      await expect(
        getCurrentUser('not-a-real-token', { userRepository }),
      ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' })
    })

    it('throws UNAUTHENTICATED if the token is valid but the user no longer exists', async () => {
      const { session } = await register(
        { email: 'deleted@example.com', password: 'a-strong-password' },
        { userRepository },
      )
      // simulate the user having been removed
      const fresh = new FakeAuthUserRepository()
      await expect(getCurrentUser(session.token, { userRepository: fresh })).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      })
    })

    it('session token payload carries the correct roles for role checks', async () => {
      const { session } = await register(
        { email: 'roles@example.com', password: 'a-strong-password' },
        { userRepository },
      )
      const payload = verifySessionToken(session.token)
      expect(payload.roles).toEqual(['customer'])
    })
  })

  describe('requireRole', () => {
    it('does not throw when the user has one of the allowed roles', () => {
      expect(() =>
        requireRole({ id: '1', email: 'a@b.com', name: null, roles: ['admin'] }, ['admin', 'customer']),
      ).not.toThrow()
    })

    it('throws when the user has none of the allowed roles', () => {
      expect(() =>
        requireRole({ id: '1', email: 'a@b.com', name: null, roles: ['customer'] }, ['admin']),
      ).toThrow(AuthError)
    })
  })

  describe('logout', () => {
    it('resolves successfully (stateless — no server-side revocation store)', async () => {
      await expect(logout()).resolves.toEqual({ success: true })
    })
  })

  describe('password reset flow', () => {
    it('generates and stores a reset token for a known email', async () => {
      const user = userRepository.seed({ email: 'forgot@example.com' })
      const result = await requestPasswordReset('forgot@example.com', { userRepository })

      expect(result.userFound).toBe(true)
      expect(result.token).toEqual(expect.any(String))

      const stored = await userRepository.getById(user.id)
      expect(stored?.resetPasswordToken).toBe(result.token)
      expect(stored?.resetPasswordExpiration!.getTime()).toBeGreaterThan(Date.now())
    })

    it('does not throw and reports userFound: false for an unknown email (no enumeration)', async () => {
      const result = await requestPasswordReset('nobody@example.com', { userRepository })
      expect(result.userFound).toBe(false)
      expect(result.token).toBeUndefined()
    })

    it('resets the password with a valid token and logs the user in', async () => {
      const user = userRepository.seed({ email: 'reset@example.com' })
      const { token } = await requestPasswordReset('reset@example.com', { userRepository })

      const result = await resetPassword({ token: token!, newPassword: 'brand-new-password' }, { userRepository })
      expect(result.user.id).toBe(user.id)
      expect(result.session.token).toEqual(expect.any(String))

      // New password now works for a normal login.
      const loginResult = await login(
        { email: 'reset@example.com', password: 'brand-new-password' },
        { userRepository },
      )
      expect(loginResult.user.id).toBe(user.id)
    })

    it('invalidates the reset token after use (cannot be reused)', async () => {
      userRepository.seed({ email: 'onetime@example.com' })
      const { token } = await requestPasswordReset('onetime@example.com', { userRepository })

      await resetPassword({ token: token!, newPassword: 'first-new-password' }, { userRepository })

      await expect(
        resetPassword({ token: token!, newPassword: 'second-new-password' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
    })

    it('rejects an unknown/invalid token', async () => {
      await expect(
        resetPassword({ token: 'not-a-real-token', newPassword: 'a-new-password-123' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
    })

    it('rejects a weak new password', async () => {
      userRepository.seed({ email: 'weakreset@example.com' })
      const { token } = await requestPasswordReset('weakreset@example.com', { userRepository })

      await expect(
        resetPassword({ token: token!, newPassword: 'short' }, { userRepository }),
      ).rejects.toMatchObject({ code: 'WEAK_PASSWORD' })
    })

    it('clears any existing account lock when the password is reset', async () => {
      const { hash, salt } = await hashPasswordPayloadCompatible('old-password')
      const user = userRepository.seed({
        email: 'lockedreset@example.com',
        hash,
        salt,
        loginAttempts: MAX_LOGIN_ATTEMPTS,
        lockUntil: new Date(Date.now() + LOCK_TIME_MS),
      })

      const { token } = await requestPasswordReset('lockedreset@example.com', { userRepository })
      await resetPassword({ token: token!, newPassword: 'fresh-password-123' }, { userRepository })

      const refreshed = await userRepository.getById(user.id)
      expect(refreshed?.loginAttempts).toBe(0)
      expect(refreshed?.lockUntil).toBeNull()
    })
  })
})
