// tests/compareAtPrice.test.ts
//
// The "was" price behind every sale badge.
//
// This is the one piece of pricing display that can make a claim to a
// customer — "Save 12%" — so the rule is asserted rather than assumed. A
// compare-at price that is not strictly higher than the current price, or
// is missing its currency, must produce NO badge rather than a misleading
// or nonsensical one.

import { describe, expect, it } from 'vitest'

import {
  toStorefrontCompareAtPrice,
  toStorefrontPrice,
} from '../src/lib/repositories/adapters/priceStorefrontAdapter'

const product = (
  price: number | null,
  currency: string | null,
  compareAtPrice: number | null,
) => ({ price, currency, compareAtPrice })

describe('toStorefrontCompareAtPrice', () => {
  it('returns the previous price when it is genuinely higher', () => {
    expect(toStorefrontCompareAtPrice(product(109900, 'USD', 124900))).toEqual({
      amount: 124900,
      currency: 'USD',
    })
  })

  it('returns null when the compare-at price equals the current price', () => {
    expect(toStorefrontCompareAtPrice(product(109900, 'USD', 109900))).toBeNull()
  })

  it('returns null when the compare-at price is LOWER — that is not a discount', () => {
    expect(toStorefrontCompareAtPrice(product(109900, 'USD', 99900))).toBeNull()
  })

  it('returns null when there is no compare-at price', () => {
    expect(toStorefrontCompareAtPrice(product(109900, 'USD', null))).toBeNull()
  })

  it('returns null when the product has no price at all', () => {
    expect(toStorefrontCompareAtPrice(product(null, 'USD', 124900))).toBeNull()
  })

  it('returns null when the currency is missing, rather than guessing one', () => {
    expect(toStorefrontCompareAtPrice(product(109900, null, 124900))).toBeNull()
  })

  it('reports the compare-at price in the same currency as the price', () => {
    const priced = product(50000, 'USD', 60000)

    expect(toStorefrontCompareAtPrice(priced)?.currency).toBe(toStorefrontPrice(priced)?.currency)
  })

  it('treats a zero price as priced, not as missing', () => {
    // A free product is still purchasable; only `null` means "no price".
    expect(toStorefrontCompareAtPrice(product(0, 'USD', 1000))).toEqual({
      amount: 1000,
      currency: 'USD',
    })
  })
})
