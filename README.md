# Store

An e-commerce application on Next.js (App Router), MongoDB via Mongoose, and
Paynow for payments. There is no CMS layer and no Stripe integration: the
application owns its own domain model, repositories, authentication, admin
area and checkout.

## Architecture

```
src/
  app/
    (pages)/        storefront routes
    (admin)/admin/  admin area (session + admin role required)
    api/            route handlers (auth, products, orders, account,
                    checkout, payments, paywall)
    _api/           server-side data access: repository wiring and the
                    fetch/read helpers the routes and pages call
    _components/    UI
    _types/         storefront view models (what components render)
  lib/
    domain/         entities and money handling — no framework, no I/O
    db/             Mongoose connection and models
    repositories/   persistence, one per aggregate, behind an interface
    services/       business rules (auth, orders, pricing, payments)
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
role. Self-registration only ever creates customers; `npm run seed:admin`
is the only way to grant admin.

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
