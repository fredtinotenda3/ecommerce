// tests/adminFlag.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { isNativeAdminEnabled } from '../src/app/_api/adminFlag'

const ENV_KEY = 'USE_NATIVE_ADMIN'
const original = process.env[ENV_KEY]

describe('isNativeAdminEnabled', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('defaults to false when the flag is unset', () => {
    delete process.env[ENV_KEY]
    expect(isNativeAdminEnabled()).toBe(false)
  })

  it('is false for any value other than the exact string "true"', () => {
    process.env[ENV_KEY] = '1'
    expect(isNativeAdminEnabled()).toBe(false)
    process.env[ENV_KEY] = 'True'
    expect(isNativeAdminEnabled()).toBe(false)
  })

  it('is true only when explicitly set to "true"', () => {
    process.env[ENV_KEY] = 'true'
    expect(isNativeAdminEnabled()).toBe(true)
  })
})
