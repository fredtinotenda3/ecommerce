# AuthService Lockout Test — Timeout Fix Report

## Problem
`tests/AuthService.test.ts > AuthService > login > locks the account after MAX_LOGIN_ATTEMPTS consecutive failures` exceeded Vitest's default 5000ms per-test timeout.

## Cause
The test performs `MAX_LOGIN_ATTEMPTS + 2` real PBKDF2 verifications (one initial hash, 5 failed-login verifications, one final locked-check verification) against the actual production `hashPasswordPayloadCompatible`/`verifyPasswordPayloadCompatible` functions, which use Payload's exact algorithm (25,000 iterations, 512-byte key, SHA-256). That's deliberate and correct — the whole point of the test is to exercise real production hashing under repeated failures — but that many real PBKDF2 rounds in one test case adds up to more than 5 seconds of wall-clock time.

## Fix
`tests/AuthService.test.ts` — passed an explicit `15000` (15s) timeout as the third argument to `it(...)` for this one test only, per the preferred approach. No other tests, no `vitest.config.ts` global default, and no production PBKDF2/hashing logic were touched — iteration count, key length, and digest are all unchanged.

```ts
it(
  'locks the account after MAX_LOGIN_ATTEMPTS consecutive failures',
  async () => { /* unchanged test body */ },
  15000,
)
```

## Validation
- `npm run test` → **136/136 passing**
- `npm run lint` → 0 errors
- `npx tsc --noEmit` → 1 pre-existing error remaining (`ArchiveBlock/index.tsx`), unchanged baseline

## Scope confirmation
Only `tests/AuthService.test.ts` was changed. No production code, no `vitest.config.ts`, no other test files. Phase 6 was not started.
