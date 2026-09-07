// tests/me.test.ts
//
// Unit tests for src/app/_api/me.ts's deps-injectable functions
// (resolveMe, resolveAuthenticatedUser), using
// FakeAuthUserRepository + FakeUserRepository so no database is
// required — same pattern as AuthService.test.ts / fetchProduct.test.ts.

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createSessionToken } from '../src/lib/auth/session'
import { resolveAuthenticatedUser, resolveMe } from '../src/app/_api/me'
import { FakeAuthUserRepository } from './fakes/FakeAuthUserRepository'
import { buildTestUser, FakeUserRepository } from './fakes/FakeUserRepository'

describe('me', () => {
  let authUserRepository: FakeAuthUserRepository
  let userRepository: FakeUserRepository

  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret-not-for-production'
  })

  beforeEach(() => {
    authUserRepository = new FakeAuthUserRepository()
    userRepository = new FakeUserRepository()
  })

  describe('resolveMe', () => {
    it('returns a null user and empty token when no token is provided', async () => {
      const result = await resolveMe(null, { authUserRepository, userRepository })
      expect(result).toEqual({ user: null, token: '' })
    })

    it('returns a null user for an invalid/garbage token', async () => {
      const result = await resolveMe('not-a-real-token', {
        authUserRepository,
        userRepository,
      })
      expect(result.user).toBeNull()
    })

    it('returns a null user when the session refers to a user that no longer exists', async () => {
      const token = createSessionToken({ userId: 'ghost-id', roles: ['customer'] })
      const result = await resolveMe(token, { authUserRepository, userRepository })
      expect(result.user).toBeNull()
    })

    it('maps a valid session onto the full storefront User shape, including purchases/cart', async () => {
      const authRecord = authUserRepository.seed({
        email: 'shopper@example.com',
        roles: ['customer'],
      })
      userRepository.seed(
        buildTestUser({
          id: authRecord.id,
          email: 'shopper@example.com',
          name: 'Shopper',
          roles: ['customer'],
          purchases: ['product_1', 'product_2'],
          cart: [{ productId: 'product_3', quantity: 2 }],
        }),
      )

      const token = createSessionToken({ userId: authRecord.id, roles: ['customer'] })
      const result = await resolveMe(token, { authUserRepository, userRepository })

      expect(result.token).toBe(token)
      expect(result.user).toMatchObject({
        id: authRecord.id,
        email: 'shopper@example.com',
        name: 'Shopper',
        roles: ['customer'],
        purchases: ['product_1', 'product_2'],
      })
      expect(result.user?.cart?.items?.[0]).toMatchObject({
        product: 'product_3',
        quantity: 2,
      })
    })
  })

  describe('resolveAuthenticatedUser', () => {
    it('returns null when no token is provided', async () => {
      const result = await resolveAuthenticatedUser(null, { authUserRepository })
      expect(result).toBeNull()
    })

    it('returns only { id, email } for a valid session — never roles/purchases/cart', async () => {
      const authRecord = authUserRepository.seed({
        email: 'checkout-user@example.com',
        roles: ['customer'],
      })
      const token = createSessionToken({ userId: authRecord.id, roles: ['customer'] })

      const result = await resolveAuthenticatedUser(token, { authUserRepository })

      expect(result).toEqual({ id: authRecord.id, email: 'checkout-user@example.com' })
    })

    it('returns null for an expired/invalid token', async () => {
      const result = await resolveAuthenticatedUser('garbage', { authUserRepository })
      expect(result).toBeNull()
    })
  })
})
