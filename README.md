# Store

An e-commerce application on Next.js (App Router), MongoDB via Mongoose, and
Paynow for payments. There is no CMS layer and no Stripe integration: the
application owns its own domain model, repositories, authentication, admin
area and checkout.

## Architecture

```
src/
  middleware.ts     applies managed redirects to incoming requests
  app/
    (pages)/        storefront routes
    (admin)/admin/  admin area (session + admin role required)
    api/            route handlers (auth, products, orders, account,
                    checkout, payments, paywall)
    api/admin/      admin write API — every route gated by requireAdmin
    media/          serves uploaded files at /media/<filename>
    _api/           server-side data access: repository wiring, read
                    helpers, and the admin mutation entry points
    _components/    UI
    _types/         storefront view models (what components render)
  lib/
    domain/         entities and money handling — no framework, no I/O
    db/             Mongoose connection and models
    repositories/   persistence, one per aggregate, behind an interface
    services/       business rules (auth, orders, pricing, payments,
                    admin write validation)
    media/          upload validation and filesystem storage
    payments/       Paynow provider adapter
    auth/           password hashing, session tokens, roles
```

The dependency direction is one way: routes and pages depend on `_api`,
which depends on services and repositories, which depend on the domain.
Nothing in `lib/domain` imports a framework, and no UI component reaches a
repository directly.

Services take repository *interfaces*, so the whole business layer is unit
tested against in-memory fakes (`tests/fakes`) with no database.

## Money

Every amount is an integer in the currency's minor units, never a float.
`src/lib/domain/money.ts` is the only place conversion and formatting
happen. Prices are always re-derived server-side from current product
records at checkout; nothing a client sends can influence what is charged.

## Admin

`/admin` requires a session whose user has the `admin` role. Everything
under it, and every endpoint under `/api/admin`, is gated by one function
(`requireAdmin`) which answers an unauthorized caller with 404 rather than
403, so the admin surface is not advertised to someone probing for it.
`tests/adminRouteAuthorization.test.ts` fails the build if a route is ever
added without that gate.

What it covers: products (create, edit, publish, price, categories, related
products, layout blocks, SEO, delete), categories, pages (hero, layout,
SEO, draft/published), media (upload, edit alt text, delete), orders (status
transitions), customers (roles), the header/footer/settings globals, and
redirects.

Two write rules are worth knowing because they will refuse an operator:

- An order can only be marked PAID once a payment for it has been confirmed
  by the provider. Payment state belongs to the Paynow callback.
- A category or media item that something still references cannot be
  deleted; the error names what is in the way.

Layout blocks and heroes are edited as JSON. Every block type the renderer
supports is therefore editable, which a hand-built block builder would not
have covered on day one; the field validates before submitting and the
server validates again on save.

## Media

Uploads are written to `MEDIA_DIR` (default `./media`) and served by a route
handler at `/media/<filename>` — deliberately not from `public/`, which the
framework serves with no say from the application.

Accepted: JPEG, PNG, GIF, WebP, AVIF, up to 10MB. The declared content type
must match the file's own magic number. SVG is rejected: it can carry
script and these files are served from this site's origin.

Stored filenames are derived from the upload's name but always sanitised
and suffixed with random bytes, so two uploads never collide and no part of
a filename can escape the directory. Files already in `public/media` from
before the migration still resolve.

In production, point `MEDIA_DIR` at a persistent volume: a container
filesystem does not survive a redeploy.

## Redirects

Managed at `/admin/redirects` and stored in MongoDB. `src/middleware.ts`
applies them, caching the rule set for a minute — so a new redirect takes
effect within a minute, without a rebuild. If the rules cannot be fetched,
requests carry on unredirected rather than failing.

`redirects.js` remains for redirects that belong to the deployment itself
and must not depend on the database being up.

## Payments

Paynow is the only provider, and it is redirect-based:

1. `POST /api/checkout/paynow/initiate` creates the order, starts the
   payment and returns a redirect URL. It reads nothing from the request
   body.
2. The customer pays on Paynow's hosted page.
3. `POST /api/payments/paynow/callback` — Paynow's server-to-server result
   URL — is the **only** thing that marks a payment successful, and only
   after hash verification. Duplicate deliveries are idempotent no-ops.
4. `GET /api/payments/paynow/return` is the browser redirect. It is
   cosmetic: it writes nothing and is never treated as proof of payment.

## Getting started

```bash
cp .env.example .env       # then fill it in
npm install
npm run validate:env       # checks required variables
npm run validate:db        # checks the database connection
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run seed:admin
npm run dev
```

The admin area is at `/admin` and requires an account with the `admin`
role. Self-registration only ever creates customers, so `npm run seed:admin`
is how the first administrator is created; after that, admins can promote
others from `/admin/customers`.

Draft content is previewed from the admin screens ("Preview draft"), which
go through `/api/preview`. That endpoint requires an admin session; if
`NEXT_PRIVATE_DRAFT_SECRET` is set, the link must carry it too.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Standard Next.js |
| `npm run lint` / `typecheck` / `test` | Static checks and unit tests |
| `npm run seed:admin` | Create or promote an administrator |
| `npm run validate:env` / `validate:db` / `validate:paynow` | Preflight checks |
| `npm run migration:*` | One-off data migrations (see `scripts/migrations`) |

## Testing

`npm run test` runs the unit suite (vitest, no database required). Anything
touching MongoDB or Paynow needs a real environment; `docker-compose.yml`
brings up the app plus a local MongoDB.
