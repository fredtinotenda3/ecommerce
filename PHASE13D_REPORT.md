# PHASE 13D IMPLEMENTATION REPORT

## Native Globals Implementation

**Gap closed:** `src/app/_api/fetchGlobals.ts` previously called Payload
GraphQL unconditionally. It now branches on `isNativeRepositoryEnabled()`
(`src/app/_api/dataSource.ts`, unchanged): when `USE_NATIVE_REPOSITORY=true`
it reads Header/Footer/Settings from MongoDB through new native
repositories; when unset/false the GraphQL path is byte-for-byte the same
code that was there before this phase.

**How globals are actually stored (confirmed from source, not assumed):**
Payload's `@payloadcms/db-mongodb` adapter stores every global (Header,
Footer, Settings, ...) as a separate document in a single `globals`
collection, discriminated by a `globalType` field equal to the global's
slug (`node_modules/@payloadcms/db-mongodb/dist/models/buildGlobalModel.js`).
The shared `link` field (`src/payload/fields/link.ts`) declares its
`reference` relationship as `relationTo: ['pages']` — an array, even
though there's only one type in it — which makes Payload treat it as a
polymorphic relation and store it as `{ relationTo: 'pages', value:
ObjectId }`, whereas the link's `icon` (a plain `relationTo: 'media'`
upload field) and Settings' `productsPage` (a plain `relationTo: 'pages'`)
are singular relations stored as bare ObjectIds. The new model/repository
mirror this exactly rather than guessing at a shape.

**New pieces, following the existing Phase 2/3 native-migration
conventions (`fetchCategoriesNative.ts`, `CategoryRepository`,
`categoryStorefrontAdapter.ts`) field-for-field:**

- `src/lib/domain/types.ts` — added `NavLink`, `NavItem`, `Header`,
  `Footer`, `Settings` domain types (additive only).
- `src/lib/db/models/Global.ts` — `strict: false` Mongoose model over the
  `globals` collection, same "read-shape-only" treatment as
  `Category`/`Page`/`Media` models in this directory.
- `src/lib/repositories/GlobalsRepository.ts` — `GlobalsRepository`
  interface + `MongoGlobalsRepository`, querying by `globalType`.
- `src/lib/repositories/adapters/globalsStorefrontAdapter.ts` — pure
  functions (`toStorefrontHeader`/`toStorefrontFooter`/
  `toStorefrontSettings`) mapping native records + already-resolved nav
  relations onto the exact shapes `HeaderNav`, `FooterComponent`,
  `CMSLink`, and the cart/checkout/logout pages already read (mirrors the
  `HEADER_QUERY`/`FOOTER_QUERY`/`SETTINGS_QUERY` GraphQL queries
  field-for-field — see `src/app/_graphql/globals.ts` and
  `src/app/_graphql/link.ts`).
- `src/app/_api/fetchGlobalsNative.ts` — testable orchestration
  (`buildStorefrontHeader/Footer/Settings`, taking repository interfaces
  so tests never touch a database) plus the DB-wired
  `fetchHeaderNative`/`fetchFooterNative`/`fetchSettingsNative`/
  `fetchGlobalsNative` functions that wire real Mongo repositories over a
  shared connection (`getDbConnection()`, unchanged).

**Behavior when a global doesn't exist yet:** `getHeader()`/`getFooter()`/
`getSettings()` return `null` rather than throwing — a fresh/seed-less
database is an expected state, not an error, matching the existing
`header: Header | null = null` try/catch fallback already in
`src/app/_components/Header/index.tsx`.

**What I did *not* change:** `fetchGlobals()` itself (the combined
`Promise.all` helper) required no edit — it already calls
`fetchSettings`/`fetchHeader`/`fetchFooter`, so it picks up the branch
automatically. Nothing under `src/payload/**` was touched.

## Header/Footer Crash Handling

I was **not able to reproduce or root-cause** the crash Phase 13c found
(`TypeError: Cannot read properties of null (reading 'useContext')` inside
`usePathname`, surfacing as a 500 on `GET /products`). This sandbox has the
identical restrictions Phase 13c hit: no MongoDB reachable, and no
`fonts.googleapis.com` access (which `next/font/google`'s `Jost` font call
in `src/app/layout.tsx` needs). I confirmed both are still blocked before
concluding I couldn't go further:

- `curl` to a MongoDB host: unreachable (same as 13c).
- `fonts.googleapis.com`: not in this environment's egress allowlist.

So I cannot confirm whether this is a real bug in the native-server path or
purely a sandbox artifact — that determination still requires an
environment with normal internet access and a real database, exactly as
13c flagged.

What I did instead, given I can't confirm the root cause:

1. **Confirmed Header/Footer are already inside the correct React tree.**
   `src/app/layout.tsx` renders `<Header />`/`<Footer />` inside
   `<Providers>`, which is standard App Router structure — so
   `usePathname` should have a valid context there under normal
   conditions. I found no evidence the components are rendered outside an
   appropriate provider.
2. **Added a proper React error boundary** (`src/app/_components/
   ErrorBoundary/index.tsx`) and wrapped `<HeaderComponent>` /
   `<FooterComponent>` in it. This means *if* a render-phase crash ever
   happens inside either component (for whatever reason, `usePathname` or
   otherwise), it degrades to rendering nothing for that section instead
   of taking down the whole page — consistent with "make the components
   safe even if header/footer data is null during native server boot."
   I deliberately did **not** wrap the `usePathname()` call itself in
   try/catch: I tried that first, but it trips
   `react-hooks/rules-of-hooks` (ESLint treats a hook call inside a
   try/catch as conditional), and `npm run lint` failed. An error boundary
   is the React-idiomatic way to contain a render-phase throw without
   breaking the rules of hooks.
3. **Fixed a real (if minor) type-safety gap unrelated to the crash
   itself:** `HeaderComponent`/`FooterComponent`/`HeaderNav` were typed to
   accept non-null `Header`/`Footer` props, but are already called with a
   possibly-`null` value from `src/app/_components/Header/index.tsx` /
   `Footer/index.tsx`'s try/catch. Widened all three prop types to
   `Header | null` / `Footer | null`. No runtime behavior change — the
   components already null-guarded via `header?.navItems` /
   `footer?.navItems` — but this removes a latent `--strict` gap.

**Honest bottom line:** this is a mitigation, not a confirmed fix. The
crash may well be entirely a sandbox artifact (as 13c suspected), in which
case the error boundary will simply never trigger in a normal environment.
If it turns out to be a real bug, the error boundary at least prevents it
from taking down the whole page while the actual cause gets diagnosed
somewhere with real network/DB access.

## Files Created

- `src/lib/db/models/Global.ts`
- `src/lib/repositories/GlobalsRepository.ts`
- `src/lib/repositories/adapters/globalsStorefrontAdapter.ts`
- `src/app/_api/fetchGlobalsNative.ts`
- `src/app/_components/ErrorBoundary/index.tsx`
- `tests/fakes/FakeGlobalsRepository.ts`
- `tests/globalsStorefrontAdapter.test.ts`
- `tests/fetchGlobalsNative.test.ts`

## Files Modified

- `src/lib/domain/types.ts`
- `src/app/_api/fetchGlobals.ts`
- `src/app/_components/Header/index.tsx`
- `src/app/_components/Header/HeaderComponent/index.tsx`
- `src/app/_components/Header/Nav/index.tsx`
- `src/app/_components/Footer/index.tsx`
- `src/app/_components/Footer/FooterComponent/index.tsx`

## Files Deleted

None.

## New Dependencies

None.

## Validation Results

Environment note: same sandbox as Phase 13c — no MongoDB, no
`fonts.googleapis.com`. `npm install --legacy-peer-deps` was needed (a
pre-existing, unrelated peer-dependency conflict between `payload@2.x` and
`@payloadcms/plugin-stripe@0.0.14`'s `payload@^1.1.8` peer requirement —
present before this phase, not introduced by it). `npm run build` was not
run, per the phase instructions (no full environment available).

**Baseline confirmed before making any changes**, to make sure I was
starting from the documented state:
- `npx tsc --noEmit` → exactly the one documented pre-existing error in
  `src/app/_blocks/ArchiveBlock/index.tsx`.
- `npm run test` → 303 tests passing across 39 files.

**lint** (`npm run lint`): 0 errors, 0 warnings.

**typecheck** (`npx tsc --noEmit`): only the same pre-existing error as
baseline:
```
src/app/_blocks/ArchiveBlock/index.tsx(40,9): error TS2322: ...
Property 'sort' does not exist on type 'IntrinsicAttributes & Props'.
```

**tests** (`npm run test`): 321 tests passing across 41 files (303
baseline + 18 new: 10 in `globalsStorefrontAdapter.test.ts`, 8 in
`fetchGlobalsNative.test.ts`). Coverage includes:
- Native globals output shape matches the GraphQL query shape (reference
  links, custom-url links, resolved icon media, null copyright, empty
  navItems).
- Missing/dangling page or media references resolve to `undefined` fields
  rather than throwing.
- "No global document exists yet" resolves to `null`, not an error.

I did **not** add a test that directly exercises `fetchGlobals.ts`'s
`isNativeRepositoryEnabled()` branch end-to-end (i.e. literally calling
`fetchHeader()`/`fetchFooter()`/`fetchSettings()` with the flag toggled).
Those functions do real I/O (a `fetch()` call to the GraphQL endpoint, or
`getDbConnection()` to Mongo), and this codebase's existing test suite
consistently avoids mocking `fetch`/the database (no `vi.mock` anywhere in
`tests/`) — untestable glue like this is handled the same way elsewhere
(e.g. the `isNativeRepositoryEnabled() ? fetchCategoriesNative() :
fetchDocs(...)` branch in `src/app/(pages)/products/page.tsx` has no
dedicated test either). What *is* tested: the flag helper itself
(`dataSource.test.ts`, pre-existing, unchanged) and the entire native-path
implementation behind the flag (this phase's 18 new tests). The
GraphQL/flag-off path is the pre-existing, already-tested-by-omission
code, left untouched.

`npm run validate:flags` (read-only, no DB/network): confirmed default
(all unset) reports every flag OFF and "this environment is behaviorally
identical to pre-Phase-2 production." Also spot-checked with
`USE_NATIVE_REPOSITORY=true` set — reports ON correctly.

## Existing Payload Status

Untouched. Nothing under `src/payload/**` was read-write; the new native
model reads the same `globals` collection Payload's own
`@payloadcms/db-mongodb` adapter writes to, via a separate Mongoose
connection (`getDbConnection()`, pre-existing from earlier phases) — same
"two connections, one database" arrangement already used by every other
native repository. Payload remains the only write path for
Header/Footer/Settings.

## Existing Stripe Status

Untouched. Not read or referenced by this phase's changes.

## Existing Auth/Admin Status

Untouched. Not read or referenced by this phase's changes.

## Remaining Blockers

1. **Real-data validation is still blocked** by this sandbox's lack of any
   reachable MongoDB — identical to Phase 13c. The native globals path is
   unit-tested against fakes and type-checks cleanly, but has never been
   exercised against a real `globals` collection. The riskiest assumption
   to verify first: that `reference.value` really is a bare `ObjectId`
   (not an embedded sub-document) for this Payload version/config — I
   derived this from reading the installed `@payloadcms/db-mongodb`
   package's own source, not from a live query, so it should be right, but
   "should be right from reading the source" is not the same as "confirmed
   against real data."
2. **The Header/Footer `usePathname` crash is still unconfirmed.** The
   error boundary added this phase prevents it from being fatal, but the
   actual cause — real bug vs. sandbox artifact — needs an environment
   with working Google Fonts access and a real database to settle, exactly
   as 13c stated.
3. **`GET /products` hanging / 500 due to `getDbConnection()` blocking on
   an unreachable Mongo host** (documented in 13c) is unrelated to this
   phase's scope and still unresolved — it will affect native-mode
   storefront reads generally, including the new globals path, until
   either a reachable database is available or `getDbConnection()` gets a
   fail-fast connection timeout (out of scope here; Phase 13c already
   flagged it as a separate concern from the globals gap).

## Recommended Next Phase

A **Phase 13E: real-environment integration pass** — ideally the first
phase run somewhere with actual internet access and a reachable MongoDB —
to: (a) confirm the `globals` collection document shape assumptions above
against real seeded data, (b) determine once and for all whether the
Header/Footer crash is a real bug or a sandbox artifact (and remove the
error boundary's uncertainty caveat either way), and (c) exercise
`GET /products`/`GET /` end-to-end with `USE_NATIVE_REPOSITORY=true` +
`USE_NATIVE_SERVER=true` to see real header/footer nav content render for
the first time in native mode. Until that happens, native mode should
still be treated as unverified against real data, per 13c's standing
caveat.

============================================================
STOP CONDITION — HONORED
============================================================
Per instructions: stopping here. Payload has not been removed. Stripe has
not been removed. No production migrations or destructive operations were
run. Waiting for explicit approval before any further phase.
