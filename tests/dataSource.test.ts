// tests/dataSource.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { isNativeRepositoryEnabled } from '../src/app/_api/dataSource'

const ENV_KEY = 'USE_NATIVE_REPOSITORY'
const original = process.env[ENV_KEY]

describe('isNativeRepositoryEnabled', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('defaults to false when the flag is unset', () => {
    delete process.env[ENV_KEY]
    expect(isNativeRepositoryEnabled()).toBe(false)
  })

  it('is false for any value other than the exact string "true"', () => {
    process.env[ENV_KEY] = '1'
    expect(isNativeRepositoryEnabled()).toBe(false)
    process.env[ENV_KEY] = 'True'
    expect(isNativeRepositoryEnabled()).toBe(false)
  })

  it('is true only when explicitly set to "true"', () => {
    process.env[ENV_KEY] = 'true'
    expect(isNativeRepositoryEnabled()).toBe(true)
  })
})
