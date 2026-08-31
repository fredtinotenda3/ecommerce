// tests/serverFlag.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { isNativeServerEnabled } from '../src/app/_api/serverFlag'

const ENV_KEY = 'USE_NATIVE_SERVER'
const original = process.env[ENV_KEY]

describe('isNativeServerEnabled', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('defaults to false when the flag is unset', () => {
    delete process.env[ENV_KEY]
    expect(isNativeServerEnabled()).toBe(false)
  })

  it('is false for any value other than the exact string "true"', () => {
    process.env[ENV_KEY] = '1'
    expect(isNativeServerEnabled()).toBe(false)
    process.env[ENV_KEY] = 'True'
    expect(isNativeServerEnabled()).toBe(false)
  })

  it('is true only when explicitly set to "true"', () => {
    process.env[ENV_KEY] = 'true'
    expect(isNativeServerEnabled()).toBe(true)
  })
})
