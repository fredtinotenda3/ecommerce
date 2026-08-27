# payloadCompatiblePassword Timeout — Fix Report

## Problem
On a slower machine, `tests/payloadCompatiblePassword.test.ts > hashPasswordPayloadCompatible > produces a hash/salt pair that verifies successfully via verifyPasswordPayloadCompatible` exceeded Vitest's default 5000ms per-test timeout.

## Cause
That test does one `hashPasswordPayloadCompatible` call followed by one `verifyPasswordPayloadCompatible` call — two real PBKDF2 rounds at Payload's exact parameters (25,000 iterations, 512-byte key, SHA-256; see `src/lib/auth/password.ts`). This is deliberate production-equivalent hashing work, not something to fake, but its wall-clock cost is CPU-dependent — on a slower machine even two rounds can exceed 5 seconds, and the same applies more broadly across the other real-PBKDF2 tests in `tests/payloadCompatiblePassword.test.ts` and `tests/AuthService.test.ts`.

## Fix
`vitest.config.ts` — added a global `testTimeout: 30000` under `test`, per the preferred approach for a machine-dependent (not test-specific) slowdown. No PBKDF2 logic, iteration count, or hashing behavior was touched anywhere in `src/`. No test files were changed.

```ts
test: {
  include: ['tests/**/*.test.ts'],
  environment: 'node',
  testTimeout: 30000,
},
```

Note: the per-test `15000`ms override added to the lockout test in `tests/AuthService.test.ts` in the previous fix is more specific than this global default and still applies to that one test (Vitest uses the most specific timeout when both are set). It was left untouched here per the instruction to change only `vitest.config.ts`; it held with margin in this environment's own run (`tests/AuthService.test.ts` passed) and does not need to be raised unless it's independently reported as timing out.

## Validation (this environment)
- `npm run test` → **136/136 passing**
- `npm run lint` → 0 errors
- `npx tsc --noEmit` → 1 pre-existing error remaining (`ArchiveBlock/index.tsx`), unchanged baseline

## Scope confirmation
Only `vitest.config.ts` was changed. No production code, no test files. Phase 6 was not started.
