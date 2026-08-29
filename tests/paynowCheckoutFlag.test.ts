// tests/paynowCheckoutFlag.test.ts
//
// PHASE 11 — this flag helper (src/app/_api/paynowCheckoutFlag.ts,
// PHASE 8) had no dedicated unit test even though its siblings did
// (dataSource.test.ts, adminFlag.test.ts). Added for parity, and to
// directly prove the 404-when-disabled contract that every
// /api/checkout/paynow/* and /api/payments/paynow/* route relies on via
// guardPaynowCheckoutEnabled() — see task 3 of the Phase 11 validation
// scope ("hidden routes return 404 when disabled").
import { afterEach, describe, expect, it } from 'vitest'
import { guardPaynowCheckoutEnabled, isPaynowCheckoutEnabled } from '../src/app/_api/paynowCheckoutFlag'

const ENV_KEY = 'USE_PAYNOW_CHECKOUT'
const original = process.env[ENV_KEY]

describe('isPaynowCheckoutEnabled', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('defaults to false when the flag is unset', () => {
    delete process.env[ENV_KEY]
    expect(isPaynowCheckoutEnabled()).toBe(false)
  })

  it('is false for any value other than the exact string "true"', () => {
    process.env[ENV_KEY] = '1'
    expect(isPaynowCheckoutEnabled()).toBe(false)
    process.env[ENV_KEY] = 'True'
    expect(isPaynowCheckoutEnabled()).toBe(false)
  })

  it('is true only when explicitly set to "true"', () => {
    process.env[ENV_KEY] = 'true'
    expect(isPaynowCheckoutEnabled()).toBe(true)
  })
})

describe('guardPaynowCheckoutEnabled', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('returns a 404 response when the flag is off, so the route looks like it does not exist', async () => {
    delete process.env[ENV_KEY]
    const guard = guardPaynowCheckoutEnabled()
    expect(guard).not.toBeNull()
    expect(guard?.status).toBe(404)
    const body = await guard?.json()
    expect(body).toEqual({ error: 'Not found' })
  })

  it('returns null (proceed) when the flag is on', () => {
    process.env[ENV_KEY] = 'true'
    expect(guardPaynowCheckoutEnabled()).toBeNull()
  })
})
