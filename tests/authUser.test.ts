// tests/nativeAuthUser.test.ts
//
// PHASE 13B — unit tests for
// src/app/_providers/Auth/authUser.ts's `mapAuthUserToStorefrontUser`,
// the pure mapper AuthProvider uses to turn a `/api/auth-native/*`
// response's `user` into the `StorefrontUser` view model the rest
// of the frontend expects.
import { describe, expect, it } from 'vitest'

import { mapAuthUserToStorefrontUser } from '../src/app/_providers/Auth/authUser'

describe('mapAuthUserToStorefrontUser', () => {
  it('maps id/email/roles straight across', () => {
    const mapped = mapAuthUserToStorefrontUser({
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      roles: ['customer'],
    })

    expect(mapped.id).toBe('user-1')
    expect(mapped.email).toBe('jane@example.com')
    expect(mapped.roles).toEqual(['customer'])
  })

  it('keeps a null name as null', () => {
    const mapped = mapAuthUserToStorefrontUser({
      id: 'user-2',
      email: 'no-name@example.com',
      name: null,
      roles: ['customer'],
    })

    expect(mapped.name).toBeNull()
  })

  it('preserves a non-null name', () => {
    const mapped = mapAuthUserToStorefrontUser({
      id: 'user-3',
      email: 'named@example.com',
      name: 'Alex',
      roles: ['admin'],
    })

    expect(mapped.name).toBe('Alex')
  })

  it('defaults cart and purchases to empty, since the native auth endpoints do not return them', () => {
    const mapped = mapAuthUserToStorefrontUser({
      id: 'user-4',
      email: 'empty@example.com',
      name: null,
      roles: ['customer'],
    })

    expect(mapped.cart).toEqual({ items: [] })
    expect(mapped.purchases).toEqual([])
  })

  it('never carries a password field onto the mapped user', () => {
    const mapped = mapAuthUserToStorefrontUser({
      id: 'user-5',
      email: 'secure@example.com',
      name: null,
      roles: ['customer'],
    })

    expect('password' in mapped).toBe(false)
  })

  it('preserves multiple roles', () => {
    const mapped = mapAuthUserToStorefrontUser({
      id: 'user-6',
      email: 'both@example.com',
      name: null,
      roles: ['admin', 'customer'],
    })

    expect(mapped.roles).toEqual(['admin', 'customer'])
  })
})
