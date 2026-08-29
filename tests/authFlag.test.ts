// tests/authFlag.test.ts
//
// PHASE 11 — this flag helper (src/app/_api/authFlag.ts, PHASE 5) had no
// dedicated unit test even though its siblings did (dataSource.test.ts,
// adminFlag.test.ts). Added for parity and because native admin access
// (AdminAccessService) short-circuits on this flag — it needs the same
// "exact string 'true', nothing else" guarantee proven directly.
import { afterEach, describe, expect, it } from 'vitest'
import { isNativeAuthEnabled } from '../src/app/_api/authFlag'

const ENV_KEY = 'USE_NATIVE_AUTH'
const original = process.env[ENV_KEY]

describe('isNativeAuthEnabled', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('defaults to false when the flag is unset', () => {
    delete process.env[ENV_KEY]
    expect(isNativeAuthEnabled()).toBe(false)
  })

  it('is false for any value other than the exact string "true"', () => {
    process.env[ENV_KEY] = '1'
    expect(isNativeAuthEnabled()).toBe(false)
    process.env[ENV_KEY] = 'True'
    expect(isNativeAuthEnabled()).toBe(false)
    process.env[ENV_KEY] = 'yes'
    expect(isNativeAuthEnabled()).toBe(false)
  })

  it('is true only when explicitly set to "true"', () => {
    process.env[ENV_KEY] = 'true'
    expect(isNativeAuthEnabled()).toBe(true)
  })
})
