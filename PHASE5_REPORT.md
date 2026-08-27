# PHASE 5 IMPLEMENTATION REPORT

## Native Auth Routes Added
All under `src/app/api/auth-native/`, flag-gated by `USE_NATIVE_AUTH=true` (404 when disabled/unset):
- `POST /api/auth-native/register` — creates a user in the existing `users` collection with a Payload-compatible PBKDF2 hash, then issues a native session (mirrors Payload's own `loginAfterCreate` hook, which also logs a user in immediately after creation).
- `POST /api/auth-native/login` — verifies email/password against whatever `hash`/`salt` is already stored, works identically for existing Payload-created users and natively-registered ones.
- `POST /api/auth-native/logout` — clears the `native-session` cookie.
- `GET /api/auth-native/me` — resolves the current user from the `native-session` cookie or an `Authorization: Bearer <token>` header (the latter included per the task's "or an Authorization: Bearer token for simplicity" note, useful for testing without a browser).
- `POST /api/auth-native/forgot-password` — generates and stores a reset token; always returns the same generic success message regardless of whether the email exists (no account-enumeration).
- `POST /api/auth-native/reset-password` — validates the token, writes a new Payload-compatible hash, invalidates the token, and immediately issues a new session (mirrors Payload's own `resetPassword.js`, which also logs the user in on success).

All six coexist with Payload's `/api/users/*` routes without conflict (distinct path prefix, distinct cookie name). None of Payload's REST auth routes, admin, or `payload-token` cookie were touched.

## Password Hashing Compatibility
**Critical correction to this phase's brief:** the brief assumed Payload uses bcrypt. It does not. Directly inspecting the installed Payload version's compiled auth strategy —
`node_modules/payload/dist/auth/strategies/local/generatePasswordSaltHash.js` and `.../authenticate.js` (Payload `2.0.7`, per `package.json`) — shows Payload uses **Node's built-in `crypto.pbkdf2`**:
- 25,000 iterations
- 512-byte derived key length
- `sha256` digest
- a random 32-byte salt, hex-encoded
- `hash` and `salt` stored as **two separate fields** on the user document (not one combined string)
- comparison via the `scmp` package (constant-time)

This was confirmed against a real, independently-computed PBKDF2 vector (see `tests/payloadCompatiblePassword.test.ts`'s `EXISTING_PAYLOAD_USER` fixture — its hash was computed directly with `crypto.pbkdf2` outside this codebase, then verified against `verifyPasswordPayloadCompatible`).

**Yes — the native auth service can verify existing Payload user passwords.** `hashPasswordPayloadCompatible` / `verifyPasswordPayloadCompatible` (`src/lib/auth/password.ts`) reproduce Payload's exact PBKDF2 parameters, so:
- An existing Payload-created user (via the storefront's create-account page or the admin UI) can log in through `/api/auth-native/login` with **no password reset required**.
- A user registered through `/api/auth-native/register` can, symmetrically, also log in through Payload's own `/api/users/login` and the Payload admin UI, since the `hash`/`salt` written are indistinguishable from what Payload itself would write.

## New Dependencies Added
**None.** Since Payload actually uses `crypto.pbkdf2` (Node's built-in module), no bcrypt/bcryptjs/argon2 dependency was needed — `package.json`, `package-lock.json`, and `yarn.lock` are untouched. This is a direct, deliberate consequence of correcting the brief's bcrypt assumption above; had Payload actually used bcrypt, a new dependency would genuinely have been required and would have been flagged here before installing, per the task's instruction.

## Files Created
- `src/lib/repositories/AuthUserRepository.ts` — a repository **separate** from the existing `UserRepository`/`MongoUserRepository`, scoped to auth fields only (`getByEmail`, `getById`, `getByResetToken`, `createUser`, `updatePasswordHash`, `setResetToken`, `invalidateResetToken`, `recordFailedLogin`, `resetLoginAttempts`).
- `src/lib/services/AuthService.ts` — orchestration only (register/login/getCurrentUser/requireRole/logout/requestPasswordReset/resetPassword), takes an `AuthUserRepository` interface (not a concrete Mongo class), mirroring the `fetchXNative.ts`/`buildStorefrontX` split from Phases 2-4.
- `src/app/_api/authFlag.ts` — the `USE_NATIVE_AUTH` flag helper, mirroring `dataSource.ts`'s `isNativeRepositoryEnabled` pattern.
- `src/app/_api/authNative.ts` — DB-wired entry points (`registerNative`, `loginNative`, `logoutNative`, `getCurrentUserNative`, `requestPasswordResetNative`, `resetPasswordNative`) that supply the concrete `MongoAuthUserRepository` to `AuthService`.
- `src/app/api/auth-native/_shared/respond.ts` — shared route-handler helpers: `NATIVE_SESSION_COOKIE` constant, `guardNativeAuthEnabled` (the 404 flag gate), `errorResponse` (maps `AuthError` codes to HTTP statuses), `setSessionCookie`/`clearSessionCookie`.
- `src/app/api/auth-native/{register,login,logout,me,forgot-password,reset-password}/route.ts` — the six route handlers.
- `tests/fakes/FakeAuthUserRepository.ts` — in-memory `AuthUserRepository` implementation for unit tests, including a `seed()` helper for simulating "existing Payload users."
- `tests/payloadCompatiblePassword.test.ts` — hash/verify tests, including the fixed-vector test proving compatibility with a hash produced by Payload's own algorithm (not this codebase's own hashing function).
- `tests/AuthService.test.ts` — 24 tests covering register, login success/failure/lockout, `me`/session validation, role checks, and the full forgot/reset-password flow.

## Files Modified
- `src/lib/auth/password.ts` — added `hashPasswordPayloadCompatible`/`verifyPasswordPayloadCompatible` (PBKDF2) alongside the existing, untouched Phase 1 scrypt `hashPassword`/`verifyPassword` pair. The old pair's own tests (`tests/auth.test.ts`) still pass unchanged — nothing was removed or renamed.
- `src/lib/db/models/User.ts` — explicitly declared `hash`, `salt`, `loginAttempts`, `lockUntil`, `resetPasswordToken`, `resetPasswordExpiration` on `UserDocument`/`UserSchema` (previously implicit `strict: false` passthrough fields that nothing native read or wrote). `strict: false` is kept for forward-compatibility with any other Payload-internal field.

## Files Deleted
None.

## Data-Fetch / Auth Approach Used
Same three-layer split established in Phases 2-4:
1. **`AuthService.ts`** (pure orchestration, repository-interface-only) — unit tested via `FakeAuthUserRepository`, no database needed.
2. **`AuthUserRepository.ts`** (Mongo-backed data access, scoped to auth fields) — deliberately a **new, separate** repository from `UserRepository.ts` rather than an extension of it. `UserRepository`'s `toDomain` mapping is consumed by cart/checkout/purchase code throughout the app and intentionally never exposes password/auth-internal fields; folding auth fields into that shared interface would risk every existing `UserRepository` caller accidentally handling password hashes in memory. This keeps `UserRepository`/`MongoUserRepository` **completely untouched**.
3. **`authNative.ts`** (DB wiring) + **route handlers** (HTTP/cookie concerns) — same pattern as `fetchProductNative.ts`/`fetchPageNative.ts`.

Sessions are stateless, HMAC-signed tokens via the existing (Phase 1, previously-unused) `src/lib/auth/session.ts` — `createSessionToken`/`verifySessionToken`, requiring `SESSION_SECRET`. Delivered via a dedicated `native-session` cookie (httpOnly, sameSite=lax, secure in production), distinct from Payload's `payload-token`, per the task's preference for a separate cookie name.

## Environment Flag
`USE_NATIVE_AUTH=true` (new). Independent of `USE_NATIVE_REPOSITORY` — a deployment could have native storefront reads on without exposing native auth routes, or vice versa. When unset/false, all six `/api/auth-native/*` routes return `404 { error: 'Not found' }`, chosen over `405` so the routes appear not to exist at all rather than confirming their presence (the frontend doesn't call them yet either way, so there's no functional cost to hiding them by default).

## Validation Results
- **lint** (`npm run lint`): **0 errors.**
- **typecheck** (`npx tsc --noEmit`): **1 error — pre-existing, in `src/app`, matching the stated baseline exactly**:
  - `src/app/_blocks/ArchiveBlock/index.tsx(40,9)` — `sort` prop passed to `CollectionArchive` doesn't exist on its `Props` type (unrelated to auth; untouched).
- **tests** (`npm run test`): **136/136 passing** (18 test files) — the prior 104 plus 32 new: 8 in `payloadCompatiblePassword.test.ts` (hash/verify, including the fixed Payload-compatible vector) and 24 in `AuthService.test.ts` (register incl. duplicate-email/weak-password rejection; login success/failure/lockout/unlock-on-success; `me` incl. missing/malformed/stale-user tokens; role checks; logout; full forgot→reset→re-login password flow incl. token single-use and lock-clearing on reset).

## Existing Payload Auth status
Untouched. `src/payload/collections/Users/index.ts`, Payload's `auth: true` config, its REST/GraphQL auth endpoints, `payload-token` cookie handling, and all Payload auth hooks (`createStripeCustomer`, `loginAfterCreate`, `ensureFirstUserIsAdmin`, `resolveDuplicatePurchases`) are unmodified. Existing users continue to log in through Payload exactly as before, with no forced password resets — verified directly by the PBKDF2 compatibility work above.

## Existing Storefront Auth status
Untouched. `src/app/_providers/Auth/index.tsx` and all of `src/app/(pages)/{login,create-account,recover-password,reset-password,logout}/**` still call Payload's `/api/users/*` exclusively. Nothing in the live UX was changed or wired to the new native routes.

## Existing Stripe/Checkout status
Untouched. No changes to `src/payload/stripe/*`, checkout routes, `CheckoutForm`, cart logic, or `UserRepository`'s `updateCart`/`appendPurchases` (used by checkout).

## Existing Admin status
Untouched. No native admin UI was built; Payload's admin remains the only write path for collections other than the auth fields this phase's routes write to on the `users` collection specifically.

## Remaining Risks
- **No server-side session revocation store.** Native sessions are stateless HMAC tokens; `logout` can only clear the cookie client-side — a token issued before logout remains cryptographically valid until it expires (7-day default TTL from `createSessionToken`). This is a known limitation of any stateless-JWT-style scheme without a blocklist/allowlist, not something Payload's own JWT approach avoids either, but is worth flagging as a gap if native auth is ever activated for real.
- **No email delivery is wired up for `forgot-password`.** The reset token is generated and persisted correctly, but nothing sends it anywhere — building an email pipeline (reusing or duplicating Payload's `emailOptions`/nodemailer config) was out of this phase's scope ("native auth service and route handlers", not "email infrastructure"). The route's response never includes the token, so this is safe (no leak) but non-functional end-to-end until a follow-up phase wires delivery.
- **The native login-lockout counter (`loginAttempts`/`lockUntil`) is a separate, parallel counter from whatever Payload's own local strategy tracks on the same fields.** Both read/write the identical `loginAttempts`/`lockUntil` fields on the same document, so a failed attempt via ONE system currently also counts toward (and can trigger) a lockout enforced by the OTHER system, since they share the same underlying document fields. This is actually a point of *accidental* interoperability rather than divergence — flagged because it wasn't a deliberate design goal and its exact interaction with Payload's own lockout timing wasn't independently verified beyond confirming the shared default constants (`maxLoginAttempts: 5`, `lockTime: 600000`).
- **No uniqueness constraint / transaction around `register`'s email-check-then-create.** `getByEmail` then `createUser` is not atomic; a race between two concurrent registrations for the same email could both pass the check. Payload itself relies on a unique index for this (not confirmed present on the native `UserSchema`'s `email` field beyond the existing non-unique `UserSchema.index({ email: 1 })`). Low risk given native auth isn't live yet, but worth a follow-up hardening pass before any real activation.

## Recommended Phase 6
Per the stated stop condition, wait for explicit approval. When approved, reasonable next slices (each separately gated) would be: (a) adding a unique index on `email` and wrapping `register` in a transaction to close the race above; (b) wiring real reset-token email delivery; (c) only then — and only with separate, explicit sign-off — considering an actual frontend switch from Payload's `/api/users/*` to `/api/auth-native/*`, which the task's stop condition explicitly reserves for later.
