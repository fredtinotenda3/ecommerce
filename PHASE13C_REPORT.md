# PHASE 13C INTEGRATION VALIDATION REPORT

## Environment Used

This validation ran inside a sandboxed container with a restricted
network egress allowlist (npm/yarn registries, GitHub, apt/Ubuntu
mirrors, PyPI/crates equivalents). Critically, **no MongoDB host of any
kind is reachable from this sandbox** — not the placeholder Atlas
cluster in `.env.example`, not a downloadable `mongod` binary, and not
Docker Hub (so `docker-compose.yml`'s `mongo:latest` service can't be
pulled either — Docker itself is also unavailable in this sandbox).
`fonts.googleapis.com` is likewise unreachable, which matters because
`src/app/layout.tsx` calls `next/font/google` at module-init time.

Concretely, before doing anything else:

- `curl` to the Atlas host from `.env.example` → `Connection timed out
  after 10002 milliseconds`.
- `apt-cache policy mongodb` → no candidate; MongoDB's own server
  package isn't in Ubuntu's repos and isn't reachable to add.
- `which docker mongod mongosh` → none present.

Given the phase instructions ("If the environment cannot run the app,
clearly state that and perform static validation only"), that's what
this report does — plus a partial dynamic pass that turned out to be
possible and valuable (see below): the native server *can* boot without
a database, so I exercised it as far as that allows.

**No staging/test database was ever used against real data.** Nothing
in this phase reached a real MongoDB instance, so no claim below should
be read as "verified against real data" unless explicitly stated
otherwise.

## Flags Enabled

Set in a local, gitignored `.env` (copied from `.env.example`, not
committed, not part of the deliverable zip):

```
USE_NATIVE_REPOSITORY=true
USE_NATIVE_AUTH=true
USE_NATIVE_ADMIN=true
USE_NATIVE_SERVER=true
USE_PAYNOW_CHECKOUT=false   (left off — no Paynow test credentials provided)
```

Confirmed live via `npm run validate:flags` (reads the same flag
helpers the app uses, zero DB/network dependency):

```
USE_NATIVE_REPOSITORY="true"  -> ON
USE_NATIVE_AUTH="true"        -> ON
USE_NATIVE_ADMIN="true"       -> ON
USE_PAYNOW_CHECKOUT="false"   -> OFF
USE_NATIVE_SERVER="true"      -> ON
```

## Storefront Reads Tested

Could not be tested against real data (no DB). What I *could* do: boot
`USE_NATIVE_SERVER=true` (which never initializes Payload — confirmed
by log line `[native-server] Starting Next.js (native server — Payload
was never initialized)...`) and send real HTTP requests to it.

- `GET /products` → **HTTP 500**, reproducibly, across multiple
  independent runs (see Runtime Issues Found).
- `GET /` → never returned within a 15–25s window; the request appears
  to hang, consistent with the native repository's `getDbConnection()`
  attempting to open a Mongoose connection to the unreachable Atlas
  host and blocking on the driver's connection timeout rather than
  failing fast.
- `GET /products/[slug]`, `GET /[page-slug]`, `POST /api/paywall` —
  not exercised; all of these also call `getDbConnection()` and would
  hit the identical blocker.

## Auth Flows Tested

Not exercised via HTTP. Every `/api/auth-native/*` handler
(`register`, `login`, `me`, `logout`, `forgot-password`,
`reset-password`) calls into `src/app/_api/authNative.ts` /
`src/lib/services/AuthService.ts`, which use the same
`getDbConnection()` as the storefront reads — same blocker, so I didn't
spend request budget confirming the same failure mode six more times.
Statically: each route correctly calls `guardNativeAuthEnabled()`
first, matching the documented 404-when-off contract, and this part
*is* covered by existing unit tests (`authFlag.test.ts`, 3 tests) that
don't need a DB.

## Native Admin Tested

Not exercised via HTTP for the same reason. Statically reviewed
`adminAccess.ts`'s dual-flag gate (`USE_NATIVE_ADMIN` +
`USE_NATIVE_AUTH`) and confirmed it matches Phase 11's documented
"404-over-401" rationale; this logic is unit-tested
(`AdminAccessService.test.ts`, `AdminQueryService.test.ts`) independent
of a live DB.

## Checkout Identity Tested

Not exercised — depends on both native auth (session) and a live cart,
neither of which could be driven end-to-end without a database.

## Runtime Issues Found

Two issues surfaced from actually booting the server, independent of
the "no DB" blocker:

1. **Header/Footer/Settings globals are not on the native repository
   path at all.** `src/app/_api/fetchGlobals.ts` always calls Payload's
   `/api/graphql` regardless of `USE_NATIVE_REPOSITORY`. With
   `USE_NATIVE_SERVER=true` (Payload never initialized), every request
   logs `GraphQL request failed: HTTP 404 Not Found` for the Header,
   Footer, and Settings globals. `Header`'s server component does catch
   this (`header = null` on failure) — so this alone doesn't crash the
   page — but it means native-server mode can never show real
   header/footer nav content today; it's a real, unaddressed
   scope gap in the native-repository migration, not a bug in this
   phase's code.

2. **A reproducible crash**, seen on every run:
   ```
   TypeError: Cannot read properties of null (reading 'useContext')
       at t.useContext (.../next-server/app-page.runtime.dev.js:...)
       at usePathname (.../next/dist/client/components/navigation.js:124:34)
   ```
   surfacing as `⨯ TypeError: Cannot read properties of null (reading
   'useContext')` at `HeaderComponent` / `FooterComponent`, and turning
   `GET /products` into a 500. This happened consistently across
   separate server restarts and both concurrent and strictly sequential
   requests, so it isn't purely a request-race artifact.

   I was not able to fully isolate the root cause and want to be
   explicit about that rather than guess with false confidence. It
   consistently occurred in the same request lifecycle as (a) the
   Header/Footer GraphQL 404s above and (b) a separate, definitely
   sandbox-specific failure: `next/font/google`'s `Jost` font fetch to
   `fonts.googleapis.com` failing because that host isn't reachable
   from this sandbox (`Failed to fetch font 'Jost' ... Please check if
   the network is available`, retried 3x, then falls back). react and
   react-dom are deduped to a single 18.2.0 copy each (checked via `npm
   ls`), which rules out the most common cause of "Invalid hook call."
   **This needs to be re-verified in an environment with normal
   internet access (reaches Google Fonts) and a real database** before
   it's trusted as either "a real bug in the native-server path" or "an
   artifact of this sandbox's network restrictions." I'm flagging it
   rather than either dismissing it or overstating it.

## Missing Configuration

- No test/staging `DATABASE_URI` was available or reachable from this
  environment. This is the primary blocker for essentially all of
  Section "Tasks" 4a–4d in the phase instructions.
- No Paynow test credentials were provided (expected/optional per
  scope — left `USE_PAYNOW_CHECKOUT=false`, not exercised).

## Response Shape Problems

None confirmed, because no route that returns real data shapes could
be exercised against real data. Statically, the auth-native route
handlers (e.g. `register/route.ts`) return the documented
`{ message, user, token, exp }` shape and set a session cookie on
success, `{ error }` on validation failure — consistent with what
`docs/parallel-validation.md` and the Phase 5 report describe. This is
a code-reading confirmation, not a runtime one.

## Files Changed

- `docs/native-mode-validation-13c.md` (new) — a Phase 13c-specific
  checklist extending Phase 11's validation matrix for the
  flags-on-together, real-HTTP pass, including the two runtime issues
  above as explicit follow-up items.
- `PHASE13C_REPORT.md` (this file, new).

No files under `src/`, `scripts/`, or any application code were
created, modified, or deleted. `.env` was created locally for testing
and deleted before finishing; it is not part of the deliverable.

## Validation Results

- **lint**: `npm run lint` → 0 errors (unchanged from documented
  baseline).
- **typecheck**: `npx tsc --noEmit` → exactly 1 error, the pre-existing
  one in `src/app/_blocks/ArchiveBlock/index.tsx` (unchanged).
- **tests**: `npm run test` → 39 files, 303/303 tests passing
  (unchanged).
- **flags**: all four native flags confirmed `ON` via
  `npm run validate:flags` when set; confirmed all `OFF`/default
  otherwise.
- **db**: `npm run validate:db` fails to connect, as expected —
  the only reachable outcome given this sandbox's network restrictions,
  not a finding about the application itself.
- **paynow / stripe**: not exercised (no Paynow credentials; Stripe
  intentionally untouched per scope).

## Existing Payload Status

Untouched. `src/payload/**` was not modified, read only incidentally
via `payload-types` imports that already existed. Payload's own
`/admin` and GraphQL path were not exercised in this phase (no reason
to — no flag in this phase disables them, and no DB was available to
run them against either).

## Existing Stripe Status

Untouched. Not modified, not exercised, not referenced beyond what
already existed in the codebase.

## Remaining Blockers

1. **No reachable database.** This is the blocker that matters most:
   nothing in Tasks 3–4 of the phase instructions can be completed
   against real data until either (a) a test/staging `DATABASE_URI`
   reachable from wherever this validation runs is provided, or (b)
   this validation is re-run in an environment with normal outbound
   network access.
2. **Header/Footer/Settings globals aren't on the native path** — a
   real scope gap, not a bug introduced by this phase. Native-server
   mode can't fully replace the Payload-backed path until these three
   globals have a native-repository equivalent, or `USE_NATIVE_SERVER`
   keeps a documented dependency on a reachable Payload GraphQL
   endpoint for globals only.
3. **Unconfirmed crash** (`useContext` / `usePathname`) needs
   reproduction in a network-unrestricted environment to determine if
   it's real or a sandbox artifact of the blocked Google Fonts fetch.

## Recommended Next Phase

Before proposing a "Phase 13d," get a real test database in front of
this exact flag combination (any of: a local `mongod`, a Docker
`mongo:latest` container, or a disposable Atlas cluster reachable from
CI/staging) and re-run `docs/native-mode-validation-13c.md` end to end.
That single change unblocks nearly everything this phase couldn't
verify. In parallel, worth deciding explicitly whether Header/Footer/
Settings should get a native-repository path (closing gap #2 above) or
whether `USE_NATIVE_SERVER=true` is documented as requiring a reachable
Payload GraphQL endpoint for globals specifically, as a known
constraint rather than a silent gap.

Per this phase's stop condition: no Payload removal, no Stripe removal,
and no production cutover — none of that changes based on this report,
and none of it was touched.
