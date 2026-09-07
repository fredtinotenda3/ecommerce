# Final migration report

The application no longer depends on Payload CMS or Stripe. Next.js +
Mongoose + Paynow is the only runtime path; there are no feature flags left
to turn it on or off.

## What was removed

### Payload CMS

- `src/payload/**` — config, collections, globals, blocks, hooks, access
  control, seed data, admin components, endpoints.
- `src/server.payload.ts`, `src/server.default.ts`, `src/server.prod.ts`,
  `src/server.native.ts`, `src/server.ts` (the flag dispatcher) and
  `eject.ts`. There is no custom server any more: the Next.js CLI is the
  entry point, which is what App Router deployments expect.
- `src/app/_graphql/**` and the GraphQL/REST read paths that went with it
  (`fetchDoc.ts`, `fetchDocs.ts`, the GraphQL half of `fetchGlobals.ts`,
  `getMe.ts`). Storefront reads now go straight to MongoDB through the
  repository layer — one process, no HTTP hop, no loopback server at build
  time.
- `AdminBar` and the `payload-admin-bar` package; the `payload-token`
  cookie and its helper.
- Packages: `payload`, `@payloadcms/bundler-webpack`, `@payloadcms/db-mongodb`,
  `@payloadcms/plugin-cloud`, `@payloadcms/plugin-nested-docs`,
  `@payloadcms/plugin-redirects`, `@payloadcms/plugin-seo`,
  `@payloadcms/plugin-stripe`, `@payloadcms/richtext-slate`,
  `@payloadcms/eslint-config`, `payload-admin-bar`, plus `slate`, `express`,
  `react-router-dom`, `nodemon`, `copyfiles` and the webpack browser
  polyfills that only existed for the CMS bundler.

### Stripe

- `src/payload/endpoints/create-payment-intent.ts`, `src/payload/stripe/**`,
  `src/lib/payments/StripeProvider.ts`, `StripeCheckoutService`,
  `StripeOrderService`, `StripeWebhookService`,
  `src/app/_api/stripeCheckoutNative.ts`, `/api/checkout/stripe/*`,
  `/api/payments/stripe/webhook`, `/api/orders/native`.
- `PaymentService.recordProviderInitiatedPayment` — it existed only for
  Stripe's create-intent-then-create-order ordering. Paynow creates the
  order first, which `initiatePaymentForOrder` already covers.
- Stripe Elements from `/checkout`, and the `CheckoutForm` component.
- Packages: `stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- Stripe hosts removed from the Content-Security-Policy.

### Flags

All removed; there is nothing left to configure. `USE_NATIVE_REPOSITORY`,
`USE_NATIVE_AUTH`, `USE_NATIVE_ADMIN`, `USE_NATIVE_SERVER`,
`USE_PAYNOW_CHECKOUT` and `USE_NATIVE_STRIPE_CHECKOUT`, their helper modules
(`dataSource.ts`, `authFlag.ts`, `authMode.ts`, `adminFlag.ts`,
`serverFlag.ts`, `paynowCheckoutFlag.ts`, `nativeStripeCheckoutFlag.ts`) and
the `validate:flags` script are gone. The former flag-gated paths are simply
the paths.

## The architecture now

Requests reach route handlers and server components in `src/app`, which call
data-access helpers in `src/app/_api`, which call services and repositories
in `src/lib`. Services take repository *interfaces*, so the whole business
layer is unit tested against in-memory fakes with no database. `src/lib/domain`
imports no framework.

`payload-types.ts` imports: **zero**. The storefront's own view models in
`src/app/_types/storefront.ts` are the contract between adapters and
components, and `tests/noLegacyDependencies.test.ts` fails the build if a CMS
type, a CMS/Stripe package, or a CMS/Stripe script is reintroduced anywhere.

Routes that previously belonged to the CMS were replaced with native ones:

| Was | Now |
| --- | --- |
| `/api/users/*` (login, create, me, logout, reset) | `/api/auth/*` |
| `/api/users/:id` PATCH (profile + cart sync) | `PATCH /api/account` |
| `/api/orders`, `/api/orders/:id` (Payload REST) | `GET /api/orders`, `GET /api/orders/:id` |
| `/api/products`, `/api/products/:id` (Payload REST) | `GET /api/products`, `GET /api/products/:id` |
| `/api/graphql` paywall query | `POST /api/paywall` |
| `/admin` (Payload UI) | `/admin` (the application's own admin area) |

Security properties worth naming, since they were re-established rather than
inherited:

- **Ownership is enforced at the query, not after it.** Order reads are
  scoped to the session's customer id; another customer's order returns 404,
  not 403, so ids cannot be probed.
- **Roles and purchases are not customer-writable.** `PATCH /api/account`
  accepts name, email, password and cart only; `updateProfile` on the
  repository cannot express a role change. Self-registration always creates a
  `customer`; `npm run seed:admin` is the only path to `admin`.
- **Prices are server-derived.** Checkout reads nothing from the request
  body: cart contents come from the database and prices from current product
  records. A product without an authoritative price is not purchasable, and
  the UI renders no price rather than falling back to legacy data.
- **Payment success comes only from Paynow's signed callback.** The browser
  return URL writes nothing.
- `/api/preview` now requires an admin session *and* the draft secret, and
  only redirects to same-origin paths (it previously accepted any URL).

Money is an integer in minor units everywhere, converted and formatted in
one module (`src/lib/domain/money.ts`). The storefront's displayed price now
comes from the product's authoritative `price`/`currency` rather than the
Stripe `priceJSON` blob.

## Environment variables

Required:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URI` | MongoDB connection string |
| `SESSION_SECRET` | HMAC key for session tokens (32+ chars; rotating it logs everyone out) |
| `NEXT_PUBLIC_SERVER_URL` | Public origin, used for absolute URLs and the image host allow-list |
| `PAYNOW_INTEGRATION_ID` | Paynow integration id |
| `PAYNOW_INTEGRATION_KEY` | Paynow integration key |

Optional: `PAYNOW_MODE` (`test`/`live`), `PAYNOW_RESULT_URL`,
`PAYNOW_RETURN_URL` (derived from the request origin when unset — set them
explicitly behind a proxy), `PORT`, `NEXT_PUBLIC_IS_LIVE` (unset means every
response is `noindex`), `NEXT_PRIVATE_DRAFT_SECRET`,
`NEXT_PRIVATE_REVALIDATION_KEY`.

Everything Payload and Stripe needed — `PAYLOAD_SECRET`,
`PAYLOAD_PUBLIC_SERVER_URL`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOKS_SIGNING_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`PAYLOAD_PUBLIC_DRAFT_SECRET`, `REVALIDATION_KEY` — is gone from
`.env.example`.

## How to run it

```bash
cp .env.example .env        # fill in DATABASE_URI, SESSION_SECRET, PAYNOW_*
npm install
npm run validate:env        # required variables present?
npm run validate:db         # database reachable?
npm run validate:paynow     # Paynow credentials well-formed?
npm run dev                 # http://localhost:3000
```

Production: `npm run build && npm start`.

### Admin credential

There is no seeded default account, deliberately — a shipped default
password is a liability, and any such credential in a report or repository
should be treated as compromised the moment it is written down. Create your
own:

```bash
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='choose-a-strong-password-here' \
npm run seed:admin
```

Then sign in at `/login` with that email and password and open `/admin`.
The script is idempotent: re-running promotes an existing account to admin,
and only resets its password if you also pass `ADMIN_RESET_PASSWORD=true`.

Accounts that existed before the migration keep working: password hashing
uses the same PBKDF2 parameters and the same `hash`/`salt` fields as before,
so any existing admin can sign in with their current password without a
reset. If you have one, that is your fastest way in — no seeding needed.

## Verification performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean |
| `npm run lint` | 0 errors, 4 warnings (see below) |
| `npm run test` | 37 files, 325 tests, all passing |
| `npm run build` | Compiles and completes with no database configured |

The build was verified in an environment without network access to Google
Fonts, by temporarily stubbing the `next/font/google` call in
`src/app/layout.tsx`; the file is restored in the delivered code. Where you
build, that fetch will succeed. Nothing else was stubbed: every route
compiled, and the storefront read paths degraded exactly as intended when
`DATABASE_URI` was absent (logged and rendered a fallback rather than
failing the build).

## Known issues and notes

1. **Not runtime-tested.** Everything above is static verification. Nothing
   has been exercised against a real MongoDB or real Paynow credentials.
   Before production, test at minimum: sign-up, sign-in, an existing user's
   sign-in, cart sync across sign-in, a full Paynow payment including the
   callback, order history, and admin access.
2. **The `.env.example` in the original code contained a live-looking
   MongoDB Atlas username and password.** It has been replaced with a
   placeholder, but the credential was committed and should be treated as
   compromised: rotate it.
3. **Four lint warnings remain**, all pre-existing: an unused
   `targetDate` dependency in `Promotion`, and two unused variables in
   `ThemeProvider`. The theme provider ignores the stored/system preference
   and hard-codes the default theme — that looks deliberate but it makes the
   theme selector inert. Left as found rather than changed blind.
4. **Globals have no editing UI.** Header, Footer and Settings are read-only
   in code (`GlobalsRepository`) and were previously edited in the CMS admin.
   They must be edited directly in MongoDB until an admin screen is added.
   The admin area is read-only generally: it lists products, orders,
   customers, categories, pages and media, but does not write.
5. **Redirects are static.** `redirects.js` used to fetch a CMS `redirects`
   collection at build time and now returns an empty list. Add entries there,
   or back it with a repository if they must be editable.
6. **`legacy*` fields are retained** on products, users and orders
   (`legacyStripeProductId`, `legacyPriceJSON`, `legacyStripeCustomerId`,
   `legacyStripePaymentIntentId`), and `PaymentProviderName` still includes
   `'stripe'` so historical payment records deserialize. No code path reads
   any of them for a decision — they are history. `legacyPriceJSON` in
   particular is no longer displayed: a product with no native `price` shows
   no price and cannot be bought. **Run
   `npm run migration:products:prices` before going live** if any product
   still lacks a native price, or it will silently disappear from sale.
7. **The product listing API paginates without a total count.** It fetches
   one extra row to determine `hasNextPage`, so the UI shows next/previous
   rather than a page count. A `countDocuments` call would be needed for a
   true total.
8. **`CollectionArchive` filters by a single category.** The filter UI is
   single-select; the API takes one `category` parameter. Multi-select needs
   both sides extended.
9. **Next.js was upgraded 13.5.2 → 13.5.11** — the pinned version carried a
   published security advisory. This is a patch-level move within 13.5.
   ESLint 8 is end-of-life; upgrading it is a reasonable follow-up but was
   out of scope here.
10. **Phase reports are archived** under `docs/history/` rather than deleted,
    since they record why decisions were made. `docs/` keeps the still-current
    architecture notes.
