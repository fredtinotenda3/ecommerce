# PHASE 5 — Deliverable Manifest

Files included in `phase5-native-auth.zip` (paths relative to repository root):

## Created
- `src/lib/repositories/AuthUserRepository.ts`
- `src/lib/services/AuthService.ts`
- `src/app/_api/authFlag.ts`
- `src/app/_api/authNative.ts`
- `src/app/api/auth-native/_shared/respond.ts`
- `src/app/api/auth-native/register/route.ts`
- `src/app/api/auth-native/login/route.ts`
- `src/app/api/auth-native/logout/route.ts`
- `src/app/api/auth-native/me/route.ts`
- `src/app/api/auth-native/forgot-password/route.ts`
- `src/app/api/auth-native/reset-password/route.ts`
- `tests/fakes/FakeAuthUserRepository.ts`
- `tests/payloadCompatiblePassword.test.ts`
- `tests/AuthService.test.ts`

## Modified
- `src/lib/auth/password.ts` — added Payload-compatible PBKDF2 hash/verify functions alongside the existing (untouched) Phase 1 scrypt pair.
- `src/lib/db/models/User.ts` — explicitly declared the Payload auth fields (`hash`, `salt`, `loginAttempts`, `lockUntil`, `resetPasswordToken`, `resetPasswordExpiration`) that were previously implicit passthrough fields.

## Not modified / not included (confirmed untouched)
- `package.json` / `package-lock.json` / `yarn.lock` — no new dependency was added (see report: PBKDF2 is Node's built-in `crypto` module).
- Everything under `src/payload/**` (Users collection, Payload auth config, all Payload collections/hooks/globals).
- `src/app/_providers/Auth/index.tsx` and all `src/app/(pages)/{login,create-account,recover-password,reset-password,logout}/**` — the live frontend auth UX.
- `src/lib/repositories/UserRepository.ts` — the general-purpose, read-mostly user repository used by cart/checkout/purchases; deliberately left alone (see report).
