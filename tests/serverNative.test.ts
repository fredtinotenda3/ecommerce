// tests/serverNative.test.ts
//
// PHASE 13A — verifies src/server.native.ts never imports/requires
// `payload` or any `@payloadcms/*` package. This is checked at the
// source-text level rather than by importing the module and inspecting
// Node's require cache: server.native.ts calls `process.exit(0)` in its
// NEXT_BUILD branch and `app.listen(...)` (an open handle) in its
// runtime branch, neither of which is something a unit test should
// actually trigger. A source scan is simpler, doesn't need mocking
// `next`/`express`, and directly enforces the property that matters:
// this file's dependency graph must never reach into `payload`.
//
// src/server.payload.ts is checked in the opposite direction — it
// SHOULD still import `payload`, confirming the split didn't
// accidentally remove Payload from the default path.

import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf-8')

describe('src/server.native.ts', () => {
  const source = readSource('src/server.native.ts')

  it('does not import or require the `payload` package', () => {
    expect(source).not.toMatch(/from ['"]payload['"]/)
    expect(source).not.toMatch(/require\(['"]payload['"]\)/)
  })

  it('does not import or require any `@payloadcms/*` package', () => {
    expect(source).not.toMatch(/@payloadcms\//)
  })

  it('does not reference src/payload/** (collections, config, or seed)', () => {
    expect(source).not.toMatch(/\.\.\/payload\//)
    expect(source).not.toMatch(/payload\.config/)
  })

  it('exports startNativeServer', () => {
    expect(source).toMatch(/export const startNativeServer/)
  })
})

describe('src/server.payload.ts (control case — should still use Payload)', () => {
  const source = readSource('src/server.payload.ts')

  it('still imports `payload` and calls payload.init (default path unchanged)', () => {
    expect(source).toMatch(/from ['"]payload['"]/)
    expect(source).toMatch(/payload\.init/)
  })
})

describe('src/server.ts (dispatcher)', () => {
  const source = readSource('src/server.ts')

  it('does not statically import `payload` — only the runtime-selected branch may', () => {
    expect(source).not.toMatch(/^import payload from ['"]payload['"]/m)
  })

  it('dispatches on USE_NATIVE_SERVER between the two boot modules', () => {
    expect(source).toMatch(/USE_NATIVE_SERVER/)
    expect(source).toMatch(/server\.native/)
    expect(source).toMatch(/server\.payload/)
  })
})
