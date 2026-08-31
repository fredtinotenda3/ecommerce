// tests/userStorefrontAdapter.test.ts
//
// Unit tests for src/lib/repositories/adapters/userStorefrontAdapter.ts —
// pure function, no fakes/DB needed.

import { describe, expect, it } from 'vitest'

import { toStorefrontUser } from '../src/lib/repositories/adapters/userStorefrontAdapter'
import { buildTestUser } from './fakes/FakeUserRepository'

describe('toStorefrontUser', () => {
  it('maps id/email/name/roles/purchases directly', () => {
    const user = buildTestUser({
      id: 'user_1',
      email: 'a@example.com',
      name: 'Ada',
      roles: ['admin', 'customer'],
      purchases: ['product_1'],
    })

    const result = toStorefrontUser(user)

    expect(result.id).toBe('user_1')
    expect(result.email).toBe('a@example.com')
    expect(result.name).toBe('Ada')
    expect(result.roles).toEqual(['admin', 'customer'])
    expect(result.purchases).toEqual(['product_1'])
  })

  it('maps cart items from productId/quantity to the payload-types product/quantity shape', () => {
    const user = buildTestUser({
      cart: [
        { productId: 'product_1', quantity: 2 },
        { productId: 'product_2', quantity: 1 },
      ],
    })

    const result = toStorefrontUser(user)

    expect(result.cart?.items).toEqual([
      { product: 'product_1', quantity: 2 },
      { product: 'product_2', quantity: 1 },
    ])
  })

  it('maps legacyStripeCustomerId to stripeCustomerID, undefined when null', () => {
    expect(toStorefrontUser(buildTestUser({ legacyStripeCustomerId: 'cus_123' })).stripeCustomerID).toBe(
      'cus_123',
    )
    expect(
      toStorefrontUser(buildTestUser({ legacyStripeCustomerId: null })).stripeCustomerID,
    ).toBeUndefined()
  })

  it('maps name: null to undefined (not null) to match the optional payload-types field', () => {
    const user = buildTestUser({ name: null })
    expect(toStorefrontUser(user).name).toBeUndefined()
  })

  it('never leaks a real password hash — always returns an empty string placeholder', () => {
    const user = buildTestUser()
    expect(toStorefrontUser(user).password).toBe('')
  })

  it('serializes createdAt/updatedAt as ISO strings', () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z')
    const updatedAt = new Date('2024-06-01T00:00:00.000Z')
    const user = buildTestUser({ createdAt, updatedAt })

    const result = toStorefrontUser(user)

    expect(result.createdAt).toBe(createdAt.toISOString())
    expect(result.updatedAt).toBe(updatedAt.toISOString())
  })
})
