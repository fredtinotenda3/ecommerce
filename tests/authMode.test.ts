// tests/authMode.test.ts
//
// PHASE 13B — unit tests for src/app/_api/authMode.ts's `resolveAuthMode`,
// the resolver layout.tsx uses to decide what to pass `AuthProvider`.
// Mirrors tests/authFlag.test.ts's env-mocking approach for the
// underlying `USE_NATIVE_AUTH` flag.
import { afterEach, describe, expect, it } from 'vitest'

import { resolveAuthMode } from '../src/app/_api/authMode'

const ENV_KEY = 'USE_NATIVE_AUTH'
const original = process.env[ENV_KEY]

describe('resolveAuthMode', () => {
  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY]
    } else {
      process.env[ENV_KEY] = original
    }
  })

  it('resolves to "payload" when the flag is unset', () => {
    delete process.env[ENV_KEY]
    expect(resolveAuthMode()).toBe('payload')
  })

  it('resolves to "payload" for any value other than the exact string "true"', () => {
    process.env[ENV_KEY] = 'yes'
    expect(resolveAuthMode()).toBe('payload')
  })

  it('resolves to "native" only when USE_NATIVE_AUTH is exactly "true"', () => {
    process.env[ENV_KEY] = 'true'
    expect(resolveAuthMode()).toBe('native')
  })
})
