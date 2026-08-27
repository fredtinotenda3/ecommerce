// tests/AdminAccessService.test.ts
import { beforeAll, describe, expect, it } from 'vitest'

import { resolveAdminAccess } from '../src/lib/services/AdminAccessService'
import { createSessionToken } from '../src/lib/auth/session'
import { FakeAuthUserRepository } from './fakes/FakeAuthUserRepository'

describe('resolveAdminAccess', () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = 'test-secret-not-for-production'
  })

  it('denies access when USE_NATIVE_ADMIN is off, even with a valid admin token', async () => {
    const userRepository = new FakeAuthUserRepository()
    const admin = userRepository.seed({ email: 'admin@example.com', roles: ['admin'] })
    const token = createSessionToken({ userId: admin.id, roles: admin.roles })

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: false, nativeAuthEnabled: true, token },
      { userRepository },
    )

    expect(result.authorized).toBe(false)
    expect(result.user).toBeNull()
  })

  it('denies access when USE_NATIVE_AUTH is off, even with a valid admin token', async () => {
    const userRepository = new FakeAuthUserRepository()
    const admin = userRepository.seed({ email: 'admin@example.com', roles: ['admin'] })
    const token = createSessionToken({ userId: admin.id, roles: admin.roles })

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: false, token },
      { userRepository },
    )

    expect(result.authorized).toBe(false)
    expect(result.user).toBeNull()
  })

  it('denies access when there is no token', async () => {
    const userRepository = new FakeAuthUserRepository()

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: true, token: null },
      { userRepository },
    )

    expect(result.authorized).toBe(false)
  })

  it('denies access when the token is invalid/tampered', async () => {
    const userRepository = new FakeAuthUserRepository()

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: true, token: 'not-a-real-token' },
      { userRepository },
    )

    expect(result.authorized).toBe(false)
  })

  it('denies access when the token is valid but the user is not an admin', async () => {
    const userRepository = new FakeAuthUserRepository()
    const customer = userRepository.seed({ email: 'customer@example.com', roles: ['customer'] })
    const token = createSessionToken({ userId: customer.id, roles: customer.roles })

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: true, token },
      { userRepository },
    )

    expect(result.authorized).toBe(false)
    expect(result.user).toBeNull()
  })

  it('denies access when the token refers to a user that no longer exists', async () => {
    const userRepository = new FakeAuthUserRepository()
    const token = createSessionToken({ userId: 'deleted-user', roles: ['admin'] })

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: true, token },
      { userRepository },
    )

    expect(result.authorized).toBe(false)
  })

  it('grants access when both flags are on, the token is valid, and the user is an admin', async () => {
    const userRepository = new FakeAuthUserRepository()
    const admin = userRepository.seed({ email: 'admin@example.com', roles: ['admin'] })
    const token = createSessionToken({ userId: admin.id, roles: admin.roles })

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: true, token },
      { userRepository },
    )

    expect(result.authorized).toBe(true)
    expect(result.user?.email).toBe('admin@example.com')
  })

  it('grants access to a user with multiple roles including admin', async () => {
    const userRepository = new FakeAuthUserRepository()
    const admin = userRepository.seed({
      email: 'staff@example.com',
      roles: ['customer', 'admin'],
    })
    const token = createSessionToken({ userId: admin.id, roles: admin.roles })

    const result = await resolveAdminAccess(
      { nativeAdminEnabled: true, nativeAuthEnabled: true, token },
      { userRepository },
    )

    expect(result.authorized).toBe(true)
  })
})
