// tests/priceFromJSON.test.ts
//
// PHASE 13F-B — `Price`'s `product` prop was narrowed from the full
// `payload-types.ts` `Product` to `StorefrontPriceableProduct`
// (`{ priceJSON?: string | null }`, see src/app/_types/storefront.ts).
// `priceFromJSON` itself wasn't modified, but it had no test coverage
// at all before this phase, and it's the one piece of actual logic
// downstream of that type change — this locks in its behavior with the
// minimal, non-Payload-shaped inputs the narrower type now explicitly
// allows (a plain `{ priceJSON }` object satisfies it just as well as a
// full `Product` did), so a future edit to either the type or the
// function can't silently break price rendering.

import { describe, expect, it } from 'vitest'

import { priceFromJSON } from '../src/app/_components/Price'

const oneTimePriceJSON = JSON.stringify({
  data: [{ unit_amount: 1999, type: 'one_time', currency: 'usd' }],
})

const recurringPriceJSON = JSON.stringify({
  data: [
    {
      unit_amount: 999,
      type: 'recurring',
      currency: 'usd',
      recurring: { interval: 'month', interval_count: 1 },
    },
  ],
})

const multiIntervalRecurringPriceJSON = JSON.stringify({
  data: [
    {
      unit_amount: 2999,
      type: 'recurring',
      currency: 'usd',
      recurring: { interval: 'month', interval_count: 3 },
    },
  ],
})

describe('priceFromJSON', () => {
  it('formats a one-time price as USD currency', () => {
    expect(priceFromJSON(oneTimePriceJSON)).toBe('$19.99')
  })

  it('multiplies by quantity', () => {
    expect(priceFromJSON(oneTimePriceJSON, 3)).toBe('$59.97')
  })

  it('returns the raw minor-unit total (unformatted) when raw is true', () => {
    expect(priceFromJSON(oneTimePriceJSON, 3, true)).toBe('5997')
  })

  it('appends /interval for a recurring price with interval_count 1', () => {
    expect(priceFromJSON(recurringPriceJSON)).toBe('$9.99/month')
  })

  it('appends /N interval for a recurring price with interval_count > 1', () => {
    expect(priceFromJSON(multiIntervalRecurringPriceJSON)).toBe('$29.99/3 month')
  })

  it('returns an empty string for empty/falsy input, without throwing', () => {
    expect(priceFromJSON('')).toBe('')
    expect(priceFromJSON(undefined as unknown as string)).toBe('')
  })

  it('returns an empty string (not a throw) for malformed JSON', () => {
    expect(priceFromJSON('not-json')).toBe('')
  })

  it('accepts a minimal object satisfying only StorefrontPriceableProduct (no other Product fields)', () => {
    // This is the actual point of this test file: Price's prop type no
    // longer requires anything beyond `priceJSON` — a plain object with
    // just that field is exactly what a caller holding a
    // StorefrontPriceableProduct (rather than a full payload-types.ts
    // Product) would have.
    const minimalProduct: { priceJSON?: string | null } = { priceJSON: oneTimePriceJSON }
    expect(priceFromJSON(minimalProduct.priceJSON)).toBe('$19.99')
  })
})
