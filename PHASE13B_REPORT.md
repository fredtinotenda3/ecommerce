# PHASE 13B IMPLEMENTATION REPORT

## Auth Mode Behavior

`AuthProvider` (`src/app/_providers/Auth/index.tsx`) now takes a `nativeAuthEnabled`
prop, defaulting to `false`. The prop is resolved once, server-side, in
`layout.tsx` via a new `resolveAuthMode()` helper (`src/app/_api/authMode.ts`,
a thin wrapper over the existing `isNativeAuthEnabled()` in `authFlag.ts`) and
threaded down through `Providers` → `AuthProvider`, exactly mirroring the
`nativeAdminEnabled` / `AdminBar` pattern already established in Phase 13a.
This was necessary because `USE_NATIVE_AUTH` is deliberately not
`NEXT_PUBLIC_`-prefixed (so it can't leak into the client bundle by default),
and `AuthProvider` is a client component.

- **Flag off / unset (default):** every `AuthProvider` method (`create`,
  `login`, `logout`, the `me` fetch-on-mount effect, `forgotPassword`,
  `resetPassword`) takes the exact same code path it did before this phase —
  same URLs, same request bodies, same response parsing, same error
  messages. No existing line of Payload-path code was deleted; new native
  branches were added alongside it.
- **Flag on:** the same methods instead call the `/api/auth-native/*` routes
  built in Phase 5/13a, with `credentials: 'include'` so the `native-session`
  httpOnly cookie set by those routes is stored/sent like `payload-token` is
  today.

Three pages (`CreateAccountForm`, `RecoverPasswordForm`, `ResetPasswordForm`)
previously bypassed `AuthProvider` entirely and called Payload's REST
endpoints directly with inline `fetch()`. Each of those pages now branches at
the top of its submit handler: the native branch calls the corresponding
`AuthProvider` method (`create` / `forgotPassword` / `resetPassword`, which
were already defined but were dead code before this phase since these pages
never called them); the non-native branch is the original code, untouched,
so the default path stays byte-for-byte identical. `LoginForm` and
`LogoutPage` already called `useAuth().login` / `useAuth().logout`, so no
changes were needed there.

## Native Endpoints Used

| AuthProvider method | Native endpoint |
|---|---|
| `create` | `POST /api/auth-native/register` |
| `login` | `POST /api/auth-native/login` |
| `logout` | `POST /api/auth-native/logout` |
| fetch-on-mount (`user`) | `GET /api/auth-native/me` |
| `forgotPassword` | `POST /api/auth-native/forgot-password` |
| `resetPassword` | `POST /api/auth-native/reset-password` |

All requests are made with `credentials: 'include'`; the `native-session`
cookie (httpOnly, set by the route handlers) is never read or written
directly by client code.

## User Shape Mapping

`src/app/_providers/Auth/nativeAuthUser.ts` exports a pure function,
`mapNativeAuthUserToStorefrontUser`, that maps the `SanitizedAuthUser` JSON
shape (`{ id, email, name, roles }`) returned by all six `/api/auth-native/*`
routes onto the `payload-types.ts` `User` shape the rest of the frontend
(`PaywallBlocks`, `Header/Nav`, `AdminBar`, `AccountForm`, etc.) already
expects from `useAuth().user`.

This is a **separate, smaller** mapper from the existing
`userStorefrontAdapter.ts` (`toStorefrontUser`) added in Phase 13a for
server-side `getMe`/`getMeUser`. That adapter maps a full native domain
`User` (with real `cart`/`purchases`/timestamps loaded from the DB) and
lives under `src/lib` alongside Mongoose-dependent repository code — pulling
it into a `'use client'` bundle would be wrong. The client-side
`/api/auth-native/*` routes only ever return the narrower
`SanitizedAuthUser` (no cart/purchases/timestamps at all — see
`AuthService.ts`'s `sanitize`), so a second, smaller mapper is the correct
shape for what's actually available at this call site.

Mapping:
- `id`, `email`, `roles` — passed straight through.
- `name` — `null` → `undefined` (matching `payload-types.ts`'s optional
  field).
- `purchases` → `[]`, `cart` → `{ items: [] }` — **known limitation**, see
  "Differences from Payload behavior" below.
- `updatedAt` / `createdAt` → `''` — not returned by these endpoints.
- `password` → `''` — never populated, matching Payload's own
  `/api/users/me` response and `toStorefrontUser`'s convention.

Unit tests: `tests/nativeAuthUser.test.ts` (6 tests) and
`tests/authMode.test.ts` (3 tests).

## Files Created

- `src/app/_api/authMode.ts` — `resolveAuthMode()`, thin server-side resolver
  over `authFlag.ts`'s `isNativeAuthEnabled()`.
- `src/app/_providers/Auth/nativeAuthUser.ts` — `mapNativeAuthUserToStorefrontUser`
  pure mapper + `NativeAuthUser` type.
- `tests/authMode.test.ts`
- `tests/nativeAuthUser.test.ts`

## Files Modified

- `src/app/_providers/Auth/index.tsx` — added `nativeAuthEnabled` prop;
  branched `create`/`login`/`logout`/fetch-on-mount/`forgotPassword`/`resetPassword`;
  added `nativeAuthEnabled` to the exposed context value; widened `Create`'s
  arg type to accept an optional `name` (previously unused/unsent by any
  caller) and `ResetPassword`'s `passwordConfirm` to optional (native
  reset-password never needed it).
- `src/app/_providers/index.tsx` — added `nativeAuthEnabled` prop, passed to
  `AuthProvider`.
- `src/app/layout.tsx` — resolves `resolveAuthMode()` server-side, passes
  `nativeAuthEnabled={resolveAuthMode() === 'native'}` to `Providers`.
- `src/app/(pages)/create-account/CreateAccountForm/index.tsx` — added a
  native-mode branch in `onSubmit` that calls `create()`; default branch
  (direct `POST /api/users` + `login()`) unchanged.
- `src/app/(pages)/recover-password/RecoverPasswordForm/index.tsx` — added a
  native-mode branch in `onSubmit` that calls `forgotPassword()`; default
  branch unchanged.
- `src/app/(pages)/reset-password/ResetPasswordForm/index.tsx` — added a
  native-mode branch in `onSubmit` that calls `resetPassword()`; default
  branch unchanged.

## Files Deleted

None.

## New Dependencies

None.

## Validation Results

- **lint** (`npm run lint`): 0 errors.
- **typecheck** (`npx tsc --noEmit`): only the same 1 pre-existing error in
  `src/app/_blocks/ArchiveBlock/index.tsx` noted in the Phase 13a readiness
  check. No new type errors introduced.
- **tests** (`npm run test`): **303 tests passing** (39 test files) — the
  294 pre-existing tests plus 9 new ones (`authMode.test.ts`: 3,
  `nativeAuthUser.test.ts`: 6).
- **validate:flags** (`npm run validate:flags`): all flags report
  off/unset, including `USE_NATIVE_AUTH=(unset) -> OFF`; script confirms
  "this environment is behaviorally identical to pre-Phase-2 production."
- `npm run build` was **not** run, per the task instructions.

## Existing Payload Auth status

Unmodified and still the default. Every `AuthProvider` method's non-native
branch is the original Phase-0 code path, untouched line-for-line. Payload's
`/api/users/*` endpoints and the `payload-token` cookie remain exactly as
before. `LoginForm` and `LogoutPage` were not touched at all (they already
called into `useAuth()`).

## Existing Stripe/Checkout status

Untouched. No file under `checkout/`, `cart/`, or Stripe-related paths was
modified. Checkout/cart continue to read `useAuth().user` (via `AuthProvider`),
which — when native auth is off — is populated exactly as before by the
Payload `/api/users/me` response.

When native auth is **on**, `useAuth().user` is populated via the mapper
above, with `cart: { items: [] }` and `purchases: []`. This means cart/
checkout UI that reads `user.id`/`user.email`/`user.roles` for identity
purposes continues to work, but any UI that reads `user.cart` or
`user.purchases` directly off the auth context (rather than via the
separate `CartProvider`, which the codebase already uses for the actual
cart state) will see an empty array in native mode. I did not find any such
reads in the current codebase (`CartProvider` is the sole source of truth
for cart contents; `user.cart`/`user.purchases` are only read from
`account`/`AccountForm`-adjacent server-rendered pages via `getMe`, which
uses the fuller `toStorefrontUser` adapter and was not touched here) — but
flagging this as the boundary of what this phase's client-side mapper
covers.

## Existing Admin status

Untouched. `AdminBar`'s Phase 13a native-admin handling and its own
`nativeAdminEnabled` prop are unaffected — `layout.tsx`'s `AdminBar` line
is unchanged; only the new `Providers` line above it was added.

## Remaining Risks

- **Client-side native user has no cart/purchases.** As noted above, the
  `/api/auth-native/*` routes intentionally only return `SanitizedAuthUser`.
  If a future phase needs `useAuth().user.cart`/`.purchases` populated
  client-side in native mode (rather than relying on `CartProvider` /
  server-rendered `getMe`), `/api/auth-native/me` would need to return a
  richer shape, or the client would need a follow-up fetch.
- **No server-side session revocation.** Carried over from Phase 5/13a:
  native sessions are stateless HMAC tokens with no revocation store, so
  "logout" is purely a cookie-clear on both client and server.
- **`updatedAt`/`createdAt` are empty strings** on the client-mapped native
  user. No current UI reads these off `useAuth().user`, but this is a
  latent gap if one starts to.
- **Two now-live code paths per auth action** (Payload vs native) in
  `AuthProvider` and the three forms it touches increases the surface area
  slightly; the flag-off path was verified unchanged by keeping the
  original code blocks verbatim rather than rewriting them, but ongoing
  maintenance means keeping both branches in sync going forward.

## Recommended Next Phase

With the frontend now able to run end-to-end against native auth behind the
flag, a reasonable next phase would be a **flag-on integration pass**: spin
up the app with `USE_NATIVE_AUTH=true` against a real/staging DB and
exercise login/register/logout/forgot-password/reset-password through the
actual UI (this phase's validation was lint/typecheck/unit-test only, per
the task's stated scope and the instruction not to run `npm run build`).
Actual Payload/Stripe removal and production cutover remain explicitly
out of scope and awaiting separate approval, per the stop condition below.

---

**STOP CONDITION:** Phase 13b is complete. Payload and Stripe have not been
touched or removed. Waiting for explicit approval before any Payload
removal, Stripe removal, or production cutover.
