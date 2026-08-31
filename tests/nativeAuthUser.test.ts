// tests/nativeAuthUser.test.ts
//
// PHASE 13B — unit tests for
// src/app/_providers/Auth/nativeAuthUser.ts's `mapNativeAuthUserToStorefrontUser`,
// the pure mapper AuthProvider uses to turn a `/api/auth-native/*`
// response's `user` into the `payload-types.ts` `User` shape the rest
// of the frontend expects.
import { describe, expect, it } from 'vitest'

import { mapNativeAuthUserToStorefrontUser } from '../src/app/_providers/Auth/nativeAuthUser'

describe('mapNativeAuthUserToStorefrontUser', () => {
  it('maps id/email/roles straight across', () => {
    const mapped = mapNativeAuthUserToStorefrontUser({
      id: 'user-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
      roles: ['customer'],
    })

    expect(mapped.id).toBe('user-1')
    expect(mapped.email).toBe('jane@example.com')
    expect(mapped.roles).toEqual(['customer'])
  })

  it('maps a null name to undefined (matching payload-types\' optional field)', () => {
    const mapped = mapNativeAuthUserToStorefrontUser({
      id: 'user-2',
      email: 'no-name@example.com',
      name: null,
      roles: ['customer'],
    })

    expect(mapped.name).toBeUndefined()
  })

  it('preserves a non-null name', () => {
    const mapped = mapNativeAuthUserToStorefrontUser({
      id: 'user-3',
      email: 'named@example.com',
      name: 'Alex',
      roles: ['admin'],
    })

    expect(mapped.name).toBe('Alex')
  })

  it('defaults cart and purchases to empty, since the native auth endpoints do not return them', () => {
    const mapped = mapNativeAuthUserToStorefrontUser({
      id: 'user-4',
      email: 'empty@example.com',
      name: null,
      roles: ['customer'],
    })

    expect(mapped.cart).toEqual({ items: [] })
    expect(mapped.purchases).toEqual([])
  })

  it('never leaks a password hash onto the mapped user', () => {
    const mapped = mapNativeAuthUserToStorefrontUser({
      id: 'user-5',
      email: 'secure@example.com',
      name: null,
      roles: ['customer'],
    })

    expect(mapped.password).toBe('')
  })

  it('preserves multiple roles', () => {
    const mapped = mapNativeAuthUserToStorefrontUser({
      id: 'user-6',
      email: 'both@example.com',
      name: null,
      roles: ['admin', 'customer'],
    })

    expect(mapped.roles).toEqual(['admin', 'customer'])
  })
})
