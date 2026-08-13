# E-COMMERCE PLATFORM MIGRATION AUDIT
### Payload CMS + Stripe → Native Application Layer + Paynow Zimbabwe

**Repository audited:** `ecommerce-main.zip` — confirmed to be the official `@payloadcms/template-ecommerce` (v1.0.0), largely unmodified except a hardened `src/app/_api/shared.ts` build/runtime URL split and a `X-Robots-Tag` header tweak.

**Status: AUDIT ONLY. Nothing in the repository was modified, installed, uninstalled, or migrated.**

---

# EXECUTIVE SUMMARY

This is a Next.js 13 (App Router, pre-`app` fully split — uses route groups `(pages)`) application that is **inseparably fused** with Payload CMS 2.x at the framework level, not just the data level. Payload isn't a headless add-on here — it *is* the backend: it runs inside the same Express process as Next.js (`src/server.ts`), owns the MongoDB connection, generates the GraphQL schema the frontend queries, issues the JWT auth cookie the frontend trusts, and its `admin` UI is the only admin dashboard that exists.

Stripe is even more deeply embedded than a typical "payment processor" integration: **there is no native price field on the Product collection**. Pricing lives exclusively in Stripe (`priceJSON`, synced via webhooks and a `beforeChange` hook), and the client cart total, the checkout total, and the order line-item price are all computed either in the browser from stale synced JSON or from a live Stripe price lookup — never from a database-of-record price the merchant would edit directly in an admin table.

A second, more serious finding: **order creation is not payment-verified**. The checkout page calls Stripe's `confirmPayment` client-side, and only *after* the browser reports success does it `POST /api/orders` with a client-computed `total` and client-computed line-item `price` values. Nothing on the server cross-checks the created order's total against the amount actually captured on the PaymentIntent. This is a real (if currently low-blast-radius, single-store) integrity gap that the target architecture must close — not preserve.

The good news: the **storefront React components, page structure, styling, and UX are almost entirely decoupled from Payload** — they consume a thin `fetchDoc`/`fetchDocs` GraphQL abstraction and a typed `Config`. That abstraction is the seam the migration should cut along. The CMS surface (Pages, Header, Footer, Settings, 4 content blocks, SEO, drafts, nested categories) is modest — a bespoke native CMS admin covering exactly this surface is very achievable and is recommended over a general-purpose page builder.

**Recommendation in brief:** keep MongoDB (do not force a Postgres/Prisma migration — see Database Recommendation), replace Payload with a thin native repository/service layer plus a small custom Next.js admin, and replace Stripe with a `PaymentProvider` abstraction whose first (and only initially required) implementation is Paynow Zimbabwe, driven by the official `paynow` Node SDK. Product pricing becomes a first-class database field from day one — this is not optional, it is the fix for the most important architectural defect found.

---

# CURRENT ARCHITECTURE

```
Browser
 ↓
Next.js 13 App Router (src/app)
 ↓  fetch('/api/graphql') from Server Components (fetchDoc/fetchDocs)
 ↓  fetch('/api/users/*') from Client Components (Auth provider — Payload REST, not GraphQL)
Express (src/server.ts)
 ↓
Payload 2.x (payload.init() mounted onto the same Express app)
 ↓  Local API (payload.find/findByID/create/update) used inside hooks/endpoints
 ↓  GraphQL API (auto-generated from collection configs) used by the frontend
MongoDB (via @payloadcms/db-mongodb / mongoose)
```

Verified in code:
- `src/server.ts` calls `payload.init({ express: app })`, then `next()` is mounted as a catch-all handler on the *same* Express app and the *same* port. There is no separate CMS service/process — Next.js and Payload are one deployable.
- `src/app/_api/fetchDoc.ts` / `fetchDocs.ts` POST to `${apiUrl}/api/graphql` with collection-specific queries from `src/app/_graphql/*`.
- `src/app/_providers/Auth/index.tsx` talks to Payload's **REST** auth endpoints (`/api/users/login`, `/api/users/me`, `/api/users/logout`, `/api/users/create`, `/api/users/forgot-password`, `/api/users/reset-password`) directly — not GraphQL. This is a second, independent Payload dependency surface auth must account for.
- Build is unusual: `yarn build` runs `build:payload` → `build:server` (tsc) → `build:next`, and `build:next` actually **boots a local Payload+Express server on 127.0.0.1** during the Next.js build so that static generation can hit `/api/graphql` at build time (`INTERNAL_SERVER_URL`, documented in `shared.ts`). This build-time dependency on a live Payload instance is itself a migration risk (see Migration Risks).

Checkout flow, verified against actual source (`CheckoutForm/index.tsx`, `create-payment-intent.ts`, `Orders/hooks/*`):

```
Customer clicks Checkout
 ↓
Client: stripe.confirmPayment() via @stripe/react-stripe-js  (PaymentElement, client_secret from /api/create-payment-intent)
 ↓
Client (only if paymentIntent returned): POST /api/orders
      body = { total: cartTotal.raw (CLIENT-COMPUTED),
                stripePaymentIntentID: paymentIntent.id,
                items: [{ product, quantity, price: priceFromJSON(product.priceJSON) (CLIENT-COMPUTED) }] }
 ↓
Payload Orders collection create — access control only checks "adminsOrLoggedIn", does NOT re-verify amount against Stripe
 ↓
afterChange hooks: updateUserPurchases (append to user.purchases), clearUserCart (wipes user.cart)
 ↓
MongoDB
```

`create-payment-intent.ts` (server-side) *does* independently sum `stripe.prices.list()` results to build the PaymentIntent `amount` — so the **charge itself** is server-computed from Stripe. But the **Order document that becomes the system of record** is built from client-supplied numbers, and no code path re-reads the PaymentIntent to confirm `order.total === paymentIntent.amount_received`. This is flagged in Security Risks below.

---

# PAYLOAD DEPENDENCY MAP

| Payload Component | File(s) | Current Responsibility | Consumers | Replacement | Complexity |
|---|---|---|---|---|---|
| `payload.init()` + Express mount | `src/server.ts` | Boots CMS, DB connection, admin UI, REST/GraphQL servers, all in-process with Next.js | Entire app | Standalone Next.js app; DB access via a repository layer; no embedded CMS process | 🔴 High |
| Local API (`payload.find/create/update/findByID`) | Every hook, every endpoint under `src/payload/` | Internal data access used inside hooks & custom endpoints | Hooks, webhooks, endpoints | `ProductRepository`, `OrderRepository`, `UserRepository`, `PaymentRepository` (Mongoose/native driver) | 🟠 Medium |
| GraphQL API (`/api/graphql`) | Auto-generated; queried from `src/app/_graphql/*` | All storefront reads (pages, products, categories, orders, globals) | `fetchDoc.ts`, `fetchDocs.ts`, every Server Component that renders CMS/product data | Typed internal service functions (`getProduct(slug)`, `listProducts(filter)`, etc.) called directly from Server Components — no network hop needed once co-located | 🟠 Medium |
| REST auth API (`/api/users/*`) | `src/app/_providers/Auth/index.tsx` | login/logout/me/create/forgot-password/reset-password, JWT cookie issuance | Auth provider (client-side), `getMe.ts`, preview route | Native `/api/auth/*` route handlers issuing an httpOnly session cookie | 🟠 Medium |
| `payload-token` cookie | `token.ts`, `getMe.ts`, preview route, Auth provider | JWT bearer/cookie auth | Draft preview auth check, `getMe` | Native session cookie (see Authentication section) | 🟡 Low-Medium |
| Admin UI (webpack-bundled React admin) | Configured in `payload.config.ts` (`admin.bundler`, `admin.components`) | The *only* admin dashboard — products, orders, users, pages, media, globals | Store admins/staff | Custom Next.js `/admin` route group | 🔴 High |
| Collections config | `src/payload/collections/*` | Schema, access control, hooks | GraphQL schema, admin UI, Local API | Native schema (Mongoose models) + service-layer authorization | 🟠 Medium |
| Globals (`Settings`, `Header`, `Footer`) | `src/payload/globals/*` | Site-wide nav/footer/settings content | Header/Footer/Settings components | Native `settings` collection with a single document, or simple key-value config table | 🟢 Low |
| Blocks (`CallToAction`, `Content`, `MediaBlock`, `Archive`) | `src/payload/blocks/*`, rendered via `src/app/_blocks/*` | Flexible page-builder content on Pages/Products | Page/Product `layout` field, `RenderBlocks` | Native discriminated-union block schema, same rendering components reused as-is | 🟡 Low-Medium |
| Rich text (Slate editor) | `@payloadcms/richtext-slate`, `src/payload/fields/richText/*`, `RichText` component | WYSIWYG for blocks, product/page copy, media captions | `Content` block, `Media.caption` | Keep Slate JSON shape + reuse `RichText` render component; swap only the admin-side editor widget | 🟢 Low (render side) / 🟡 Medium (admin editor widget) |
| `@payloadcms/plugin-seo` | `payload.config.ts`, `product-meta`/`page-meta` field groups, `generateMeta.ts` | title/description/OG/canonical fields on Pages & Products | `generateMeta.ts`, Next.js `generateMetadata` | Native `meta` field group on Page/Product schema; `generateMeta.ts` needs almost no change | 🟢 Low |
| `@payloadcms/plugin-redirects` | `payload.config.ts`, `redirects.js` (Next config) | Redirect rules for pages/products | `next.config.js` `redirects()` | Native `redirects` collection + same `next.config.js` integration pattern | 🟢 Low |
| `@payloadcms/plugin-nested-docs` | `payload.config.ts` (`categories`) | Hierarchical category breadcrumbs/paths | Category display, product filters | Native parent/children fields + breadcrumb builder utility | 🟡 Low-Medium |
| `@payloadcms/plugin-stripe` | `payload.config.ts` (webhooks config) | Wires Stripe webhook events to Payload hooks | `priceUpdated.ts`, `productUpdated.ts` | Removed entirely; Paynow has no equivalent "sync catalogue from provider" concept because pricing moves into the DB (see §13/§20 below) | N/A — deleted |
| Drafts/versions (`versions.drafts`) | `Pages`, `Products` collections | Draft vs. published state, preview | `/api/preview`, `/api/exit-preview`, `adminsOrPublished` access | Native `status: 'draft' \| 'published'` field + same Next.js `draftMode()` API (framework-native, not Payload-specific) | 🟡 Medium |
| Access control functions | `src/payload/access/*`, per-collection `access/*.ts` | Field/document level auth | Every collection | Authorization checks inside service-layer functions / route handlers | 🟠 Medium |
| Custom admin field components | `ProductSelect.tsx`, `CustomerSelect.tsx`, `LinkToPaymentIntent.tsx` | Stripe product picker, Stripe customer picker, Stripe dashboard deep-link in admin | Payload admin UI only | Deleted (no longer meaningful once pricing is native and Stripe is gone); replaced by plain price/currency inputs in the custom admin | 🟢 Low (deletion) |
| Custom endpoints | `create-payment-intent.ts`, `customers.ts`, `products.ts`, `stripe-products.ts`, `prices.ts`, `seed.ts`, `Users/endpoints/customer.ts` | Stripe proxying + demo data seeding | Checkout, admin product-select UI, `/seed` | `create-payment-intent` → Paynow payment initiation route; Stripe proxy endpoints deleted; seed script rewritten against native schema | 🟠 Medium |

---

# STRIPE DEPENDENCY MAP

| Stripe Feature | File | Purpose | Stored Data | Replacement |
|---|---|---|---|---|
| `@stripe/react-stripe-js`, `@stripe/stripe-js` | `CheckoutPage/index.tsx`, `CheckoutForm/index.tsx` | Renders `PaymentElement`, calls `stripe.confirmPayment()` | n/a (client SDK) | Paynow redirect flow (web transactions) — no client SDK needed, since Paynow hosts its own payment page; for mobile-money (Ecocash/OneMoney) a simple phone-number form instead of an embedded element |
| `create-payment-intent.ts` endpoint | `src/payload/endpoints/create-payment-intent.ts` | Looks up Stripe customer, sums `stripe.prices.list()` per cart item, creates a `PaymentIntent` | `stripeCustomerID` on user | `POST /api/checkout/initiate`: server reads product prices **from the database**, computes authoritative total, creates `Order` + `PaymentAttempt`, calls Paynow `createPayment()`/`send()` |
| Stripe webhooks (`price.updated`, `product.created`, `product.updated`) | `src/payload/stripe/webhooks/*`, wired in `payload.config.ts` via `plugin-stripe` | One-way sync: Stripe catalogue → Payload `priceJSON` | `Product.priceJSON` | Deleted. Price becomes something the merchant edits directly in the native admin; there is no external catalogue to sync from |
| `Products.stripeProductID` field + `ProductSelect.tsx` picker | `Products/index.ts`, `Products/ui/ProductSelect.tsx` | Links a Payload product to a Stripe product; admin picker fetches `/api/stripe/products` | `Product.stripeProductID` | Deleted; renamed historically to `legacyStripeProductId` (nullable, read-only) for audit trail only |
| `Products.priceJSON` field + `beforeChange.ts` hook | `Products/index.ts`, `Products/hooks/beforeChange.ts` | On every product save, re-fetches Stripe product + all prices, stores raw Stripe API JSON | `Product.priceJSON` (raw Stripe API response) | Deleted; replaced by first-class `price` (integer, minor units) + `currency` fields, validated at the schema level |
| `Users.stripeCustomerID` + `createStripeCustomer.ts` hook + `CustomerSelect.tsx` | `Users/index.ts`, `Users/hooks/createStripeCustomer.ts` | Creates/looks-up a Stripe Customer on every new user | `User.stripeCustomerID` | Field retained but renamed `legacyStripeCustomerId` (read-only, nullable) for historical continuity — see §21. No new provider-customer object is required for Paynow (it does not have a persistent "customer" concept the way Stripe does — see Paynow Integration Design) |
| `Orders.stripePaymentIntentID` + `LinkToPaymentIntent.tsx` | `Orders/index.ts`, `Orders/ui/LinkToPaymentIntent.tsx` | Stores the PaymentIntent id; admin UI deep-links to Stripe dashboard | `Order.stripePaymentIntentID` | Field retained, renamed `legacyStripePaymentIntentId` (nullable). New orders instead populate a `payments` relation to a `Payment` document with `provider: 'paynow'` |
| `stripe` server SDK (`new Stripe(...)`) | `create-payment-intent.ts`, `beforeChange.ts`, `createStripeCustomer.ts`, both webhook files, `customers.ts`, `products.ts`, `stripe-products.ts`, `prices.ts` | Direct Stripe API calls, scattered across 8+ files | n/a | Consolidated into a single `PaynowProvider` implementing a shared `PaymentProvider` interface (see §14) |
| `priceFromJSON` utility | `src/app/_components/Price/index.tsx` (exports `priceFromJSON`) | Parses `priceJSON` client-side to render `$X.XX` and to compute the checkout line price sent to `/api/orders` | n/a (derived) | Deleted; price formatting reads directly from `product.price`/`product.currency` |
| Client-computed cart total | `Cart/index.tsx` (`useEffect` computing `total` from `JSON.parse(item.product.priceJSON)`) | Drives the number displayed in the cart AND the number sent to `/api/orders` as `total` | n/a (derived, in-memory) | Cart total becomes **display-only**; the authoritative total is always recomputed server-side at checkout time from the DB (see §16) |
| `stripe:webhooks` npm script | `package.json` | Local Stripe CLI webhook forwarding for dev | n/a | Deleted; Paynow's result URL doesn't need a local tunnel for basic testing (Paynow provides a hosted sandbox), though `ngrok`/similar may still be useful for local result-URL testing |

---

# DATABASE AUDIT

- **Adapter:** `@payloadcms/db-mongodb` (Mongoose-based), single `DATABASE_URI`.
- **Collections as Mongo collections:** `pages`, `products`, `orders`, `media`, `categories`, `users`, plus Payload's own `payload-preferences` and versions collections (`_pages_versions`, `_products_versions`) created implicitly by `versions.drafts: true`.
- **Relationships** are all Mongo `ObjectId` references (`relationship` field type), not embedded documents, except `Order.items` and `User.cart.items`, which are embedded arrays of subdocuments — both of which need transactional consistency with the parent document at write time (order creation, cart mutation).
- **No transactions are currently used anywhere in the codebase.** Order creation, purchase-list update, and cart-clear happen as three sequential, independently-awaited `payload.update()` calls inside separate `afterChange` hooks (`updateUserPurchases`, `clearUserCart`) — there is no rollback if the second write fails. This is a pre-existing consistency gap, not something introduced by Payload; it's worth fixing in the target architecture regardless of database choice.
- **No aggregation/reporting queries exist in the codebase today** — the admin's list views use Payload's generic `find()` with `where` filters only. There's no evidence of a reporting requirement that would push toward SQL.

---

# AUTHENTICATION AUDIT

Verified flow, `src/app/_providers/Auth/index.tsx` + `src/payload/collections/Users/index.ts`:

- **Registration:** `POST /api/users/create` (client) → Payload built-in `auth: true` collection endpoint → `Users.hooks.beforeChange: [createStripeCustomer]` runs (Stripe side-effect on every signup) → `Users.hooks.afterChange: [loginAfterCreate]` auto-logs-in the new user by setting the `payload-token` cookie.
- **Login:** `POST /api/users/login` → Payload compares bcrypt-hashed password, issues JWT, sets httpOnly `payload-token` cookie (default Payload behavior — cookie name/attrs configured by Payload internals, not this codebase).
- **Logout:** `POST /api/users/logout` → Payload clears the cookie.
- **Session check:** `GET /api/users/me`, called both client-side (`Auth` provider's `useEffect`) and server-side (`getMe.ts`, via a GraphQL `ME_QUERY` using `Authorization: JWT <token>` header instead of the cookie — an inconsistency: client uses cookie+REST, server uses header+GraphQL, both hitting Payload but via different transports).
- **Password recovery/reset:** `POST /api/users/forgot-password`, `POST /api/users/reset-password` — Payload built-ins, no custom email templating found in the repo (default Payload email is likely console-logged in dev; no SMTP config found in `.env.example`, meaning **production email delivery for password reset is not currently configured** — worth flagging to the business regardless of migration).
- **First-user-becomes-admin:** `ensureFirstUserIsAdmin.ts` hook — the very first user created is force-assigned the `admin` role. This is a seed-time convenience that must be replicated carefully (or explicitly run once) in the native system so a fresh deploy still has an admin account.
- **Admin auth:** Same Users collection/JWT is used for both storefront customers and CMS admin login (`roles: ['admin' | 'customer']`, `access.admin` checks `checkRole(['admin'], user)`). There is only one login surface.
- **Draft-preview auth:** `/api/preview` reads the `payload-token` cookie, calls `/api/users/me` with it as a Bearer token to confirm the user is real, then enables Next.js `draftMode()`. No role check beyond "is a valid logged-in user" — meaning *any* logged-in customer can currently view *any* draft page via this route, provided they also know the `PAYLOAD_PUBLIC_DRAFT_SECRET`. Worth tightening to an admin-only check during the rewrite (🟡 Medium security note, not a blocking migration issue).

**Consumers of `payload-token`:** `Auth` provider (implicit, via cookie on `credentials: 'include'` fetches), `getMe.ts` (explicit header read), `/api/preview` route.

**Replacement design:** native `/api/auth/{register,login,logout,me,forgot-password,reset-password}` route handlers; bcrypt (or argon2) password hashing; a signed, httpOnly session cookie (JWT or opaque session id — JWT is a reasonable like-for-like swap since the frontend contract barely changes). Single `users` table/collection retains `roles` for the admin/customer distinction — no separate admin auth system needed, matching current behavior.

---

# PRODUCT DOMAIN AUDIT

**Schema (`Products/index.ts`):** `title` (required), `publishedOn` (auto-set on publish), `layout` (blocks: CallToAction/Content/MediaBlock/Archive — CMS content *about* the product), `stripeProductID` (text, admin-only picker), `priceJSON` (hidden textarea, read-only, holds raw Stripe price list JSON), `enablePaywall` + `paywall` (blocks gated by `checkUserPurchases` access function), `categories` (relationship, hasMany), `relatedProducts` (relationship, hasMany, self-excluding), `slug`, `skipSync` (internal flag to prevent hook loops on webhook-driven writes). Versioned (`versions.drafts: true`).

**Access:** `read: () => true` (public), `create/update/delete: admins`.

**Hooks:** `beforeChange: beforeProductChange` (Stripe sync — see Stripe map), `afterChange: revalidateProduct` (calls `revalidate({collection:'products', slug})` which hits `/api/revalidate?...&secret=...`), `afterRead: populateArchiveBlock` (resolves `Archive` block's dynamic collection query into concrete docs for rendering), `afterDelete: deleteProductFromCarts` (scrubs the deleted product out of every user's `cart.items`).

**⚠️ Critical finding (restated from Executive Summary):** there is genuinely no `price` field on this schema today. `priceJSON` is not a price — it's a cached copy of a Stripe API list response, parsed at render/checkout time by `priceFromJSON()`. Any native replacement must add real `price`/`currency`/(optionally `compareAtPrice`) fields and treat them as the single source of truth from the very first implementation phase — this is core to the "no more provider-defines-catalogue" objective in §13/§14 of the task brief, not an optional cleanup.

**`checkUserPurchases` access function** gates the `paywall` block's `read` access to only users whose `purchases` array contains this product's id — this is a real, in-use "digital product paywall" feature (separate from checkout) that must be preserved.

---

# ORDER DOMAIN AUDIT

**Schema (`Orders/index.ts`):** `orderedBy` (relationship→users, populated server-side via `populateOrderedBy` hook from `req.user`, not client-supplied), `stripePaymentIntentID` (text), `total` (number, required, min 0 — **but see checkout flow: this is client-supplied, not recomputed server-side**), `items` (array of `{product, price, quantity}` — `price` here is also client-supplied per item).

**Access:** `read: adminsOrOrderedBy` (a customer can only read their own orders; admins read all), `create: adminsOrLoggedIn`, `update/delete: admins`.

**Hooks (`afterChange`):** `updateUserPurchases` (appends every ordered product id to `user.purchases`, dedup'd via a separate field-level hook `resolveDuplicatePurchases`), `clearUserCart` (wipes `user.cart.items` to `[]` — this is *why* the frontend doesn't clear the cart itself post-payment, per the comment in `CheckoutForm/index.tsx`).

**No order status field exists at all.** There's no `PENDING`/`PAID`/`FAILED` state machine in the current schema — an order document's mere *existence* is treated as proof of a successful payment, created only from the client-side `if (paymentIntent)` branch after `confirmPayment()` returns. This is the single largest structural gap relative to the target architecture's requirement (§18) for an explicit order/payment state machine, and it's also why idempotency is currently unenforced — nothing stops a flaky network retry from calling `POST /api/orders` twice with the same `stripePaymentIntentID`.

---

# CART AUDIT

Cart is **user-backed** (persisted as `User.cart.items`, a `CartItems` group field on the Users collection), with an in-memory + `localStorage` fallback for anonymous/pre-auth state, verified in `src/app/_providers/Cart/index.tsx`:

1. On mount, hydrate from `localStorage.getItem('cart')`, re-fetching each product via `GET /api/products/:id` to repopulate full product objects (needed because localStorage only stores `{product: id, quantity}`).
2. On auth status change to `loggedIn`, `MERGE_CART` dispatches, combining local cart items with `user.cart` from the server (reducer logic in `Cart/reducer.ts` — not fully inspected here but referenced as the merge authority).
3. On auth status change to `loggedOut`, cart is cleared from local state (not from localStorage explicitly at that point).
4. On every cart change once initialized: if logged in, `PATCH /api/users/:id { cart: flattenedCart }` (writes straight to Payload, no separate Cart collection/endpoint — cart persistence *is* a user-document field write); if logged out, `localStorage.setItem('cart', ...)`.
5. Cart total is recomputed client-side on every change by parsing each item's `product.priceJSON` — this value never touches the server until checkout, and (per the Order Domain finding above) the *same client-computed number* is what ends up as `Order.total`.

**Target design:** cart persistence pattern (user-document field for authenticated users, localStorage for guests, merge-on-login) is sound and should be preserved as-is. Only the total/price computation needs to move server-side — the cart *display* total can remain client-computed for UX responsiveness as long as checkout independently recomputes and is authoritative.

---

# CMS AUDIT

| CMS Feature | Payload Implementation | Frontend Consumer | Replacement Design |
|---|---|---|---|
| Pages | `Pages` collection, `tabs` field (Hero / Content), `layout` blocks, `versions.drafts` | `src/app/(pages)/[slug]/page.tsx`, root page | Native `pages` collection: `title`, `slug`, `hero`, `layout` (block array), `status`, `meta` |
| Hero variants | `src/payload/fields/hero.ts`, rendered via `src/app/_heros/{HighImpact,MediumImpact,LowImpact,CustomHero,Product}` | Page top-of-fold | Schema + render components unchanged; only the admin-side field editor is rebuilt |
| Content block | `src/payload/blocks/Content`, `src/app/_blocks/Content` | Rich text + column layout | Unchanged render component; native schema mirrors Payload's block shape |
| CallToAction block | `src/payload/blocks/CallToAction`, `src/app/_blocks/CallToAction` | CTA banner w/ link + rich text | Same as above |
| MediaBlock | `src/payload/blocks/MediaBlock`, `src/app/_blocks/MediaBlock` | Image/video embed with optional caption | Same as above |
| ArchiveBlock | `src/payload/blocks/ArchiveBlock`, `src/app/_blocks/ArchiveBlock`, `populateArchiveBlock` hook | Dynamic "show N products/pages by collection or manual selection" | Same schema; `populateArchiveBlock` logic re-implemented as a plain service function called at read time (not a DB hook) |
| Rich text (Slate) | `@payloadcms/richtext-slate`, `RichText` component, `label`/`largeBody` custom Slate elements | Every block's copy | Store the same Slate JSON AST; keep `RichText` renderer; only swap the *editing* widget in the new admin (could keep Slate itself, or move to a simpler editor — not required for parity) |
| Links field | `src/payload/fields/link.ts`, `src/app/_graphql/link.ts`, `Link` component | Nav items, CTAs — supports internal (relationship) or external (custom URL) targets | Native equivalent field shape; unchanged render component |
| SEO fields | `@payloadcms/plugin-seo`, consumed in `generateMeta.ts` | `generateMetadata()` in Page/Product routes | Native `meta: {title, description, image}` group on Page & Product schemas |

**No formal page templates beyond the single `Pages` collection + blocks were found** (no evidence of `Payload` "collections of collections" style multi-content-type CMS beyond Pages/Products themselves) — this keeps the native CMS admin scope small and well-bounded.

---

# ADMIN AUDIT

Everything currently lives in Payload's auto-generated admin UI (bundled via `@payloadcms/bundler-webpack`, customized only with a `BeforeLogin` and `BeforeDashboard` component — both cosmetic). Based on the collection/global configs actually present, the native admin needs, at minimum:

- **Products:** list/create/edit/publish-or-draft/delete, price + currency fields, categories multi-select, image upload, block-based content editor, SEO fields, paywall toggle+content.
- **Categories:** CRUD, parent selection (nested-docs equivalent), image.
- **Orders:** list (filterable by status once that field exists), detail view showing customer, items, total, payment status/reference — **read-mostly**, since the current schema has no admin-editable order fields beyond what's set at creation.
- **Customers (Users):** list, detail (orders, purchases, role), role management (admin/customer), no delete-your-own-account UI needed (not present today either).
- **CMS:** Pages CRUD w/ blocks editor, Header/Footer/Settings singleton editors, Media library (upload/browse/alt text).
- **Admin/Users management:** role assignment gated to admins, matching `checkRole(['admin'], user)`.

No evidence of more advanced admin needs (bulk actions, CSV export, multi-warehouse inventory, multi-currency admin UI, discount codes, etc.) exists in the current codebase — scope the new admin to what's listed above, not a hypothetical superset.

---

# MEDIA AUDIT

`Media` collection (`src/payload/collections/Media.ts`): local disk storage (`staticDir: path.resolve(__dirname, '../../../media')`), fields are `alt` (required) and `caption` (Slate rich text). Access: public read. `@payloadcms/plugin-cloud` is registered in `payload.config.ts` but no cloud storage credentials appear in `.env.example`, so **in its current configured state media is served from local disk**, not S3/Cloud. Payload's upload field automatically produces image URLs consumed via `Media/Image` and `Media/Video` components, and via `next.config.js`'s `images.domains` allow-list.

**Replacement:** the migration should decide between (a) keep local-disk storage with a native Express/Next.js static route + upload handler (simplest, matches current production reality), or (b) take the opportunity to move to object storage (S3-compatible) since Zimbabwe-hosted infra and Vercel-style deployments make persistent local disk fragile anyway (see Migration Risks — this is worth deciding explicitly, not defaulting). Either way, **URL shape should be preserved or 301-redirected** so existing `<img>` references embedded in already-published rich text/blocks don't break.

---

# SEO AUDIT

`generateMeta.ts` reads `doc.meta.{title,description,image}` (populated by `plugin-seo`) and feeds Next.js `generateMetadata`/`mergeOpenGraph`. No `sitemap.xml` or `robots.txt` route was found in the repository — SEO surface today is limited to per-document meta tags and OpenGraph; there is nothing further to regress against. Native `meta` field group replacement is a direct, low-risk port.

---

# CHECKOUT FLOW

See Current Architecture above for the verified diagram and the client-trust gap. Summarized risk: **total and per-item price are client-supplied at order-creation time**, and **no idempotency key or duplicate-PaymentIntent check exists** on `POST /api/orders`.

---

# CURRENT PAYMENT FLOW

```
Cart (client-computed total from priceJSON)
 ↓
POST /api/create-payment-intent (server re-sums from live Stripe price lookups — authoritative for the CHARGE only)
 ↓
Stripe PaymentElement + confirmPayment() (client)
 ↓
POST /api/orders  (client-supplied total + per-item price — NOT re-validated against the PaymentIntent)
 ↓
Payload Orders create → afterChange hooks (updateUserPurchases, clearUserCart)
 ↓
Client redirects to /order-confirmation?order_id=...  (no server-side confirmation step reads the PaymentIntent status again)
```

# TARGET PAYMENT FLOW

```
Cart (display total only)
 ↓
POST /api/checkout/initiate
   Server: re-reads every cart item's product from the DB (authoritative price/currency/availability)
   Server: computes total
   Server: creates Order (status=PENDING_PAYMENT) + PaymentAttempt (status=PENDING) atomically
   Server: calls PaynowProvider.createPayment() → Paynow API (web: redirect URL + pollUrl; mobile: instructions + pollUrl)
 ↓
Customer completes payment at Paynow (web redirect) or on their phone (Ecocash/OneMoney USSD prompt)
 ↓
Paynow → POST resultUrl (server-to-server, hash-signed) AND/OR customer browser → GET returnUrl
 ↓
Server: on resultUrl callback — validate hash, look up PaymentAttempt by merchant reference, idempotently
         transition Payment → PAID (or FAILED/CANCELLED), transition Order → PAID, clear cart, trigger fulfilment
 ↓
Server: returnUrl handler does NOT itself mark anything paid — it only redirects the customer to
         an order-status page that reads current DB state (and may proactively poll Paynow's pollUrl once,
         as a fallback belt-and-braces check, but the resultUrl callback remains the source of truth)
```

This directly satisfies §16's "do not trust browser redirects as proof of payment" requirement — the `returnUrl` handler in the target design is purely a UX redirect, never a state-mutating endpoint.

---

# PAYNOW INTEGRATION DESIGN

Based on the current official Paynow Node.js SDK and developer documentation (`developers.paynow.co.zw`, `github.com/paynow/Paynow-NodeJS-SDK`, npm package `paynow`):

- **Auth model:** merchant-level `INTEGRATION_ID` + `INTEGRATION_KEY` (not per-customer OAuth, not a customer-object model like Stripe Customers — this is why `legacyStripeCustomerId` has no direct Paynow successor; Paynow doesn't need a stored "customer" concept).
- **Two transaction types:**
  - **Web-based** (`paynow.createPayment(reference)` + `paynow.send(payment)`): returns a `redirectUrl` (send the customer to Paynow's hosted payment page, where they choose card/EcoCash/OneMoney/bank) and a `pollUrl`.
  - **Mobile-based** (`paynow.createPayment(reference, email)` + `paynow.sendMobile(payment, phoneNumber, 'ecocash' | 'onemoney')`): pushes a payment prompt directly to the customer's phone, returns `instructions` (text to show the user) and a `pollUrl`. Only Ecocash-on-Econet and OneMoney-on-Netone numbers are currently supported per the docs — this constrains which mobile flow to offer based on the customer's number.
- **`resultUrl`** — server-side callback Paynow POSTs transaction results to. Must be publicly reachable (not localhost) and is where hash validation happens (Paynow's docs have dedicated "Generating Hash" / "Validating Hash" pages — the SDK is expected to handle this, but the audit should re-verify the SDK's `pollTransaction`/callback-parsing helpers against the live docs at implementation time rather than hand-rolling hash logic from memory).
- **`returnUrl`** — browser redirect target after the customer finishes at Paynow; can carry a merchant reference in the query string, used only to look up the order for display, never to mark it paid (per Paynow's own docs: *"If you do not specify a return URL, you will have to rely solely on polling status updates"* — i.e., Paynow itself treats the return URL as non-authoritative, reinforcing the design in §16).
- **Polling (`pollUrl` + `paynow.pollTransaction(pollUrl).paid()`)** — used both as the primary mechanism if a merchant doesn't have a public resultUrl yet (e.g. local dev), and as a safety-net re-check the server can perform on order-status-page load if a resultUrl callback hasn't arrived yet.
- **Currency:** Paynow's SDK examples use decimal amounts (e.g. `payment.add("Bananas", 2.5)`), so a conversion layer from the app's authoritative minor-unit integer price (e.g. cents) to decimal is needed at the provider-adapter boundary — keep the DB in minor units regardless, convert only at the Paynow adapter edge.
- **Before implementation:** re-fetch and re-verify the "Initiate a transaction," "Status Update," "Polling for a Status Update," "Generating Hash," and "Validating Hash" pages at `developers.paynow.co.zw` — this audit consulted the SDK quickstart and system-layout overview, which is sufficient to design the abstraction below, but the exact hash algorithm and callback payload field names should be re-confirmed against the live docs immediately before writing the `PaynowProvider` implementation (Phase 7), not assumed from this audit.

---

# TARGET ARCHITECTURE

```
Browser
 ↓
Next.js 13 App Router (unchanged storefront components/UX)
 ↓  Server Components call service-layer functions directly (no internal network hop)
 ↓  Client Components call native Next.js Route Handlers (/api/auth/*, /api/cart, /api/checkout/*, /api/admin/*)
Service / Repository layer (ProductRepository, OrderRepository, UserRepository, PaymentRepository, CmsRepository)
 ↓
MongoDB (Mongoose models, transactions where multi-document consistency matters: order creation, payment state transitions)

PaymentProvider interface
 ├── PaynowProvider (createPayment, getPaymentStatus, verifyPayment/handleCallback, refundPayment*)
 └── LegacyStripeProvider (read-only — historical order lookups only, not invocable for new payments)
```

`*` Paynow's refund story is limited/manual per current docs — flag as a business-process (not purely technical) item during Phase 7 scoping rather than assuming an API-driven refund exists.

---

# DATABASE RECOMMENDATION

### Option A — Keep MongoDB, replace Payload's data layer
**Pros:** Zero data-migration risk (no schema/engine translation, no downtime, no dual-write period). Existing relationship shapes (ObjectId refs) port directly to a hand-rolled Mongoose model layer. Embedded subdocuments (`Order.items`, `User.cart.items`) already model the two places where document-level atomicity actually matters, and Mongo's single-document atomicity covers exactly those cases without needing multi-document transactions for the common path. Lower total migration risk and shorter timeline. Hosting story unchanged (Atlas or self-hosted Mongo, however it's run today).
**Cons:** Weaker relational guarantees for genuinely relational reporting (e.g., ad hoc joins across orders/users/products for admin analytics) — though no such reporting exists in the codebase today. No native foreign-key constraints; referential integrity is app-enforced (already true today).

### Option B — Migrate to PostgreSQL + Prisma
**Pros:** Strong relational integrity, real multi-table transactions, better fit if the business later wants BI/reporting tooling, Prisma's type-safe migrations, generally easier to hire for.
**Cons:** Full data migration required (users, products, orders, media refs, categories, pages, carts) with transformation risk for every embedded/nested Payload structure (blocks, rich text JSON, relationship arrays) — each needs a bespoke mapping to relational tables/JSON columns. Real downtime or dual-write complexity risk during cutover. This is a second large migration bolted onto an already large architectural migration, for a relational-integrity benefit the current application doesn't yet need (order/payment consistency is achievable with MongoDB's document + transaction model for this schema's shape — carts and orders are naturally document-shaped).

### Recommendation: **Option A — retain MongoDB.**
The order/payment consistency requirements in §18/§19 of the brief are achievable with MongoDB multi-document transactions (available since MongoDB 4.0, and this app's `Order` + `Payment` + `User.cart` writes are a small, well-bounded transaction scope) combined with idempotency keys. A Postgres+Prisma migration would add substantial risk and calendar time to a project whose primary objective is decoupling from Payload and Stripe, not changing database engines. Revisit Postgres only if a future, distinct business need for relational reporting emerges — that would be its own, separately-scoped project.

---

# DATA MIGRATION PLAN

Since the database engine is not changing (Option A), this is a **schema-normalization migration within MongoDB**, not a cross-engine migration — materially lower risk than the brief's template implies, but still executed with the same discipline.

| Current Payload Data | Target Data | Transformation | Risk |
|---|---|---|---|
| `users` collection | `users` collection (native schema) | Drop Payload-internal fields (`_verified`, Payload's internal auth metadata); rehash nothing (bcrypt hashes are portable if the same algorithm/library is used); `stripeCustomerID` → `legacyStripeCustomerId` (renamed, frozen) | 🟡 Medium (auth continuity) |
| `products` collection | `products` collection (native schema) | **Backfill `price`/`currency` for every product** by parsing existing `priceJSON` one time during migration (last-known Stripe price → seed the new authoritative field, then merchant reviews/corrects in the new admin); `stripeProductID` → `legacyStripeProductId`; drop `priceJSON`, `skipSync` | 🔴 Critical (getting this wrong mis-prices live products) |
| `categories` collection | `categories` collection | Direct port; flatten/rebuild nested-docs `breadcrumbs` field if relied upon by frontend | 🟢 Low |
| `pages` collection | `pages` collection | Direct port of `layout` blocks and `hero`; convert `_status` → `status` enum | 🟢 Low |
| `media` collection | `media` collection + files | Direct port of metadata; physical files copied/left in place depending on storage decision (see Media Audit) | 🟡 Medium (if storage location changes) |
| `orders` collection | `orders` + new `payments` collection | Each existing order gets one synthetic `Payment` document: `provider: 'stripe'`, `providerReference: stripePaymentIntentID`, `status: 'PAID'` (all existing orders are implicitly paid, since none could exist otherwise under the current flow), `paidAt` backfilled from `order.createdAt` as a best-effort approximation | 🟠 High (historical accuracy of backfilled `paidAt`) |
| Globals (`settings`, `header`, `footer`) | Native `settings`, singleton documents | Direct port, 1:1 field mapping | 🟢 Low |
| `User.cart` | `User.cart` (unchanged shape) | Direct port | 🟢 Low |
| Historical Stripe references | Preserved as `legacy*` fields (see above) | No transformation beyond renaming | 🟢 Low |

Migration must be non-destructive, scripted, logged, and dry-run-validated against a copy of production data before touching production, per §30 — no `DROP`/`TRUNCATE` at any point, and the migration script should be idempotent/re-runnable (write to new field names alongside old ones initially, verify, then remove old fields in a later, separate phase).

# HISTORICAL STRIPE DATA PLAN

`legacyStripeCustomerId`, `legacyStripeProductId`, `legacyStripePaymentIntentId` fields preserve every existing Stripe reference, read-only, admin-visible. Historical orders remain fully readable through the new `payments` relation (`provider: 'stripe'`). The Stripe admin dashboard link component (`LinkToPaymentIntent.tsx`) can be preserved read-only in the new admin, conditionally rendered only when `legacyStripePaymentIntentId` is present, so support staff can still trace pre-migration transactions in Stripe's own dashboard if needed.

---

# ROUTE/API MIGRATION MAP

| Route | Current Implementation | Payload Dependency | Target Implementation |
|---|---|---|---|
| `/`, `/[slug]`, `/products`, `/products/[slug]`, `/cart` | Server Components via `fetchDoc`/`fetchDocs` | GraphQL | Same components, service-layer calls |
| `/checkout` | `CheckoutPage` + Stripe Elements | `create-payment-intent` endpoint, Payload Orders create | Paynow-driven checkout (see Target Payment Flow) |
| `/order-confirmation` | Reads `order_id` query param, fetches order | GraphQL (`ORDER` query) | Same shape, reads via `OrderRepository`, also handles Paynow `returnUrl` redirect |
| `/account`, `/account/orders`, `/account/purchases`, `/orders/[id]` | Reads `getMe()` + order/purchase GraphQL queries | GraphQL, REST `/api/users/me` | Native auth session + `OrderRepository`/`UserRepository` |
| `/login`, `/create-account`, `/recover-password`, `/reset-password`, `/logout` | Payload REST auth endpoints | `/api/users/*` | Native `/api/auth/*` route handlers |
| `/api/preview`, `/api/exit-preview` | Payload token validation + Next.js `draftMode()` | `payload-token` validation via `/api/users/me` | Native session validation (framework `draftMode()` itself is not Payload-specific and is unchanged) |
| `/api/revalidate` | `revalidateTag`, secret-gated | None (already framework-native) | Unchanged |
| Payload admin (`/admin/*`) | Full Payload admin UI | 100% | Custom `/admin` route group |
| `/api/graphql` | Payload auto-generated | 100% | Removed |
| `/api/stripe/customers`, `/api/stripe/products` (admin picker proxies) | `customers.ts`, `products.ts` endpoints | Stripe SDK | Removed (no equivalent needed — pricing is native) |
| `stripe:webhooks` (Stripe CLI script) | Local dev tooling | Stripe | Removed; add a Paynow `resultUrl` route handler + local tunnel doc note if needed for dev testing |

---

# SECURITY RISKS

- 🔴 **CRITICAL — Order creation trusts client-supplied total/price.** `POST /api/orders` accepts `total` and per-item `price` from the browser with no server-side reconciliation against the actual charge amount. Must be closed in the target architecture (server always recomputes from DB + verified payment amount) — this is a correctness requirement of the new checkout flow, not a nice-to-have.
- 🔴 **CRITICAL — No idempotency on order/payment creation.** A retried request or duplicate provider callback can currently create... nothing prevents it structurally today because order creation is a one-shot client POST with no dedup key. Target design requires a `merchantReference`/idempotency key uniqueness constraint at the DB level, not just application logic.
- 🟠 **HIGH — Draft-preview route allows any authenticated user to view any draft**, not just admins (`/api/preview` checks "is logged in," not "is admin"). Tighten during the auth rewrite.
- 🟠 **HIGH — No SMTP/email provider configured** for password-reset emails in `.env.example` — a pre-existing gap, worth surfacing to the business regardless of this migration, since native auth will need to send these emails too.
- 🟡 **MEDIUM — Auth transport inconsistency** (cookie+REST client-side vs. header+GraphQL server-side) — consolidate to one consistent mechanism in the rewrite to reduce surface area for auth bugs.
- 🟡 **MEDIUM — Build-time dependency on a live local Payload server** (`INTERNAL_SERVER_URL` trick in `src/server.ts`/`shared.ts`) is itself an availability risk during builds; the target architecture removing this dependency (Server Components calling functions directly, no HTTP hop) is a net security *and* reliability improvement, not just an architecture preference.
- 🟢 **LOW — Payment provider secrets:** `STRIPE_SECRET_KEY` is currently server-only (never sent to the browser) — same discipline must carry over to `PAYNOW_INTEGRATION_KEY`.

---

# MIGRATION RISKS

- 🔴 **CRITICAL — Authentication continuity.** Getting session/cookie/hash migration wrong logs out or locks out every existing customer. Mitigate: keep the same bcrypt hashing scheme so existing password hashes remain valid without forcing a mass password reset; run both auth systems in parallel behind a feature flag during Phase 10 before full cutover.
- 🔴 **CRITICAL — Historical order/payment preservation.** Backfilling `Payment` documents for existing orders (see Data Migration Plan) must be scripted, dry-run validated, and reviewed before running against production — an error here corrupts financial history.
- 🔴 **CRITICAL — Product price backfill accuracy.** Parsing `priceJSON` to seed the new authoritative `price` field must be spot-checked against the live Stripe dashboard before cutover; a parsing bug here would silently mis-price live products.
- 🟠 **HIGH — Build-time architecture change.** Removing the "boot a local Payload server during `next build`" trick changes the build pipeline meaningfully; CI/CD and Vercel (`vercel.json`'s `buildCommand: yarn build`) configuration need updating in lockstep, not as an afterthought.
- 🟠 **HIGH — GraphQL removal touches every Server Component that renders CMS/product data** — wide blast radius even though each individual change is mechanical (swap a `fetchDoc` call for a service-layer call with the same return shape).
- 🟡 **MEDIUM — Media/storage location decision** (local disk vs. object storage) affects existing image URLs referenced inside already-published rich text — must be resolved with a redirect/compatibility plan if the decision is to move storage.
- 🟡 **MEDIUM — Paynow mobile-money constraints** (Ecocash/Econet and OneMoney/Netone only, per current docs) may not match 100% of the existing customer base's payment habits under Stripe (card-only) — a business/product conversation, not just an engineering one, should happen before Phase 7.

---

# PHASED IMPLEMENTATION PLAN

The brief's suggested phases hold up well against what the audit found; only minor sequencing adjustments are proposed (native pricing fields moved earlier, since almost everything else — checkout, admin, order model — depends on them existing first).

- **Phase 0 — Audit** *(this document)*
- **Phase 1 — Architecture & domain model.** Finalize native schemas (Products incl. `price`/`currency` from day one, Orders incl. `status`, new `Payment`/`PaymentAttempt` models).
- **Phase 2 — Repository/service abstraction layer**, initially reading from the *existing* Mongo collections via Mongoose models that map onto Payload's current schema shape (so nothing breaks yet) — this de-risks the GraphQL removal by giving Server Components a stable interface to swap onto before the underlying schema changes.
- **Phase 3 — Decouple frontend from Payload GraphQL**, swapping `fetchDoc`/`fetchDocs` calls for the Phase 2 service layer, storefront-visible behavior unchanged.
- **Phase 4 — Native schema migration** (add `price`/`currency`/`status`/`legacy*` fields alongside existing ones; backfill scripts; dry-run validated).
- **Phase 5 — Native authentication**, run in parallel with Payload auth behind a flag, cut over per-environment (dev → staging → prod) only after verifying session continuity.
- **Phase 6 — Native CMS/admin**, built against the Phase 1-4 schema.
- **Phase 7 — Paynow integration**, `PaymentProvider` abstraction + `PaynowProvider`, re-verifying hash/callback docs live before writing the callback handler.
- **Phase 8 — New checkout/order/payment lifecycle**, wired to Paynow, with the idempotency and server-side total verification fixes designed above.
- **Phase 9 — Data migration** (users, historical orders/payments, product price backfill) — dry run, then production, fully logged.
- **Phase 10 — Parallel validation** — both stacks live, synthetic + manual QA against the checklist in Testing Strategy.
- **Phase 11 — Production cutover.**
- **Phase 12 — Remove Payload** (uninstall packages, delete `src/payload/`, remove the Express boot process, simplify `src/server.ts` away entirely in favor of plain Next.js).
- **Phase 13 — Remove Stripe** (uninstall SDKs, delete remaining Stripe endpoint files, drop the `LegacyStripeProvider` once historical-order UI no longer needs live Stripe dashboard deep-links, or keep it indefinitely as a read-only historical reference — business decision, not a technical requirement to remove it).

---

# TESTING STRATEGY

No tests currently exist in the repository (confirmed — no `*.test.*`, `*.spec.*`, `__tests__/`, or `e2e/` directories found). Available scripts today are `lint`, and `tsc --noEmit` is implied by `build:server`; there is no dedicated `npm run build` "just typecheck" script separate from the full multi-step production build. Before each migration phase, run:

```bash
npm run lint
npx tsc --noEmit
npm run build   # full build, since a lighter build-only check doesn't currently exist
```

Net-new test coverage to add, prioritized by the risk classification above:
1. Authentication (register/login/logout/session/reset-password) — 🔴
2. Server-side checkout total/price recomputation (reject client-tampered totals) — 🔴
3. Duplicate/idempotent payment callback handling — 🔴
4. Order state machine transitions (all paths in §18) — 🔴
5. Product pricing retrieval (native `price`/`currency` fields) — 🟠
6. Cart merge-on-login, cart persistence — 🟠
7. Failed/cancelled Paynow payment handling — 🟠
8. Admin authorization boundaries (admin-only mutations) — 🟠
9. CMS block rendering (all 4 block types) + draft/preview access control — 🟡
10. Media upload + URL stability — 🟡
11. SEO metadata generation — 🟢

---

# ROLLBACK STRATEGY

Because Phases 2–8 build the new system alongside the old one (feature-flagged auth, parallel repository layer initially reading the *unmodified* existing schema), rollback through Phase 9 is simply "don't cut the flag over" / redeploy the prior build. The only genuinely hard-to-rollback step is **Phase 9 (data migration)**, which is why it's scripted additively (new fields alongside old, nothing deleted until a separate, later cleanup phase after Phase 11 has been stable in production for an agreed bake period). Payload and Stripe package/code removal (Phases 12–13) happen last, specifically so that reverting to the old stack remains possible (`git revert` + redeploy + point `DATABASE_URI` at the pre-migration data, if the additive-field strategy was followed) for as long as practically needed before those phases are executed.

---

# FILES LIKELY TO CHANGE

Non-exhaustive, by area (full list will be produced at the start of Phase 1 once schemas are finalized):

- **Deleted wholesale:** `src/payload/**` (collections, globals, blocks-config, stripe/, endpoints Stripe-specific), `src/app/_graphql/**`, `payload.config.ts`, `src/server.ts` (replaced with plain Next.js), Stripe packages in `package.json`.
- **Rewritten:** `src/app/_api/**` (fetchDoc/fetchDocs/getMe/token → service-layer calls + native auth), `src/app/_providers/Auth/**`, `src/app/(pages)/checkout/**`, `src/app/(pages)/login|create-account|recover-password|reset-password/**`, `src/app/api/preview|exit-preview/route.ts`.
- **Unchanged or near-unchanged:** all of `src/app/_components/**`, `src/app/_blocks/**`, `src/app/_heros/**`, `src/app/(pages)/[slug]/**`, `src/app/(pages)/products/**` (render layer), `src/app/_providers/Cart/**` (logic mostly unchanged, price source swapped), `next.config.js`, `redirects.js`, `csp.js`.
- **New:** `src/lib/db/**` (Mongoose models), `src/lib/repositories/**`, `src/lib/payments/**` (`PaymentProvider`, `PaynowProvider`, `LegacyStripeProvider`), `src/app/admin/**` (new custom admin), `src/app/api/auth/**`, `src/app/api/checkout/**`, `src/app/api/payments/paynow/callback/**`.

---

# RECOMMENDED FIRST IMPLEMENTATION PHASE

**Phase 1 (Architecture & domain model) + the read-only half of Phase 2 (repository layer over the existing, unmodified schema).** Concretely: define the Mongoose models and `ProductRepository`/`PageRepository`/`CategoryRepository` read functions that return data in the *same shape* the frontend already consumes from `fetchDoc`/`fetchDocs`, without touching the database, without removing GraphQL yet, and without touching auth, cart, checkout, or Stripe at all. This is the lowest-risk, highest-leverage first step: it proves the abstraction seam works end-to-end on read-only storefront pages before anything payment- or auth-related is touched, and it can be built and merged with zero production behavior change (it's dead code until Phase 3 wires it in).

---

*End of audit. Per the migration brief's stop condition: no files were modified, no dependencies were installed or removed, no database or production configuration was changed. Awaiting explicit approval before Phase 1 begins.*
