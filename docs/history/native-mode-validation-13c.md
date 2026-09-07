# Phase 13c — Native-Mode Integration Validation Checklist

This extends `docs/parallel-validation.md` (Phase 11) with a checklist
specific to **running the app with all native flags on at once**
(`USE_NATIVE_REPOSITORY`, `USE_NATIVE_AUTH`, `USE_NATIVE_ADMIN`,
`USE_NATIVE_SERVER`), against a real staging/test MongoDB database. Phase
11's matrix validates each flag in isolation via unit tests; this
checklist is for the end-to-end, flags-on-together, real-HTTP pass that
unit tests can't cover — actually booting the app and hitting it.

**This checklist could not be executed live in the Phase 13c sandbox** —
see `PHASE13C_REPORT.md` for why (no reachable MongoDB). Use it as-is the
first time this validation is run against a real staging database.

## Prerequisites

- [ ] A disposable/test MongoDB reachable from wherever the app runs
      (local `mongod`, Docker `mongo:latest`, or a scratch Atlas
      cluster — anything that is *not* the production database).
- [ ] `.env` populated from `.env.example` with `DATABASE_URI` pointing
      at that test database, plus a valid `PAYLOAD_SECRET`.
- [ ] The four flags set: `USE_NATIVE_REPOSITORY=true`,
      `USE_NATIVE_AUTH=true`, `USE_NATIVE_ADMIN=true`,
      `USE_NATIVE_SERVER=true`. Leave `USE_PAYNOW_CHECKOUT=false` unless
      Paynow test credentials are available.
- [ ] Outbound network access to Google Fonts
      (`fonts.googleapis.com`) — the root layout loads the `Jost` font
      at build/module-init time via `next/font/google`; if that fetch
      cannot complete, treat any resulting error as an environment
      artifact, not an application bug (see report).
- [ ] `npm run validate:flags` confirms all four flags read `ON`
      before starting the server.
- [ ] `npm run validate:db` confirms the test database is reachable
      before testing any storefront/auth/admin route.

## Boot

- [ ] `npm run dev` (or the built equivalent) starts without throwing
      during module init.
- [ ] Server log shows `[native-server] Starting Next.js (native
      server — Payload was never initialized)...` — confirms Payload
      was not booted.

## Storefront reads (`USE_NATIVE_REPOSITORY=true`)

- [ ] `GET /` returns 200, and the page's product/category content
      matches what's actually in the test database (not just "doesn't
      crash").
- [ ] `GET /products` returns 200 with the seeded product list.
- [ ] `GET /products/[slug]` returns 200 for a real slug in the test
      DB and 404 for a nonexistent one.
- [ ] `GET /[page-slug]` returns 200 for a real CMS page doc.
- [ ] `POST /api/paywall` returns the expected shape for both a public
      and a gated document.
- [ ] Header/Footer/Settings globals render with real content, not a
      fallback/empty state — see **Known gap** below; these do **not**
      go through the native repository today and will need Payload's
      GraphQL API reachable at `NEXT_PUBLIC_SERVER_URL` (or
      `INTERNAL_SERVER_URL`) even when every other flag is native.

## Native auth (`USE_NATIVE_AUTH=true`)

- [ ] `POST /api/auth-native/register` — 201, sets a session cookie,
      returns `user`/`token`/`exp`.
- [ ] `POST /api/auth-native/login` — 200 with valid credentials, 401
      with invalid ones.
- [ ] `GET /api/auth-native/me` — 200 with a valid session cookie, 401
      without one.
- [ ] `POST /api/auth-native/logout` — clears the session cookie.
- [ ] `POST /api/auth-native/forgot-password` /
      `POST /api/auth-native/reset-password` — exercise the full
      round trip with a real token.
- [ ] Re-run each route with the flag off and confirm 404 (already
      covered by `tests/authFlag.test.ts`, but worth a live spot-check
      once in staging).

## Native admin (`USE_NATIVE_ADMIN=true`, requires `USE_NATIVE_AUTH=true`)

- [ ] `GET /native-admin` — 404 with no session; 404 for a
      non-admin session; 200 for an authorized admin session.
- [ ] `/native-admin/products` and `/native-admin/orders` render real
      data for an admin session.
- [ ] Inspect responses/HTML for `hash`, `salt`,
      `resetPasswordToken`, `loginAttempts`, `lockUntil` — none should
      appear (unit-tested in `AdminQueryService.test.ts`; re-confirm
      against real documents once).

## Checkout identity

- [ ] Add an item to cart, reach `/checkout`, and confirm the
      identity used for order attribution is the native session's
      user, not a stale/Payload identity.
- [ ] Do not attempt a real payment unless valid Paynow test
      credentials are configured and `USE_PAYNOW_CHECKOUT=true`.

## Wrap-up

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test` all still
      pass (0 lint errors; only the pre-existing `ArchiveBlock` tsc
      error; all existing tests green) — confirms this validation pass
      touched no application code.
- [ ] File every runtime gap found (missing env var, wrong response
      shape, unhandled error) against `PHASE13C_REPORT.md`'s "Remaining
      Blockers" before proposing Phase 13d.
