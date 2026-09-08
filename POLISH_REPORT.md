# Tech Haven — product polish and brand pass

Everything below is in `tech-haven-polish.zip` (135 changed/new files, plus
`DELETED_FILES.txt` listing 11 files to remove).

**Validation:** `npx tsc --noEmit` clean · `npx eslint src` clean (0 errors, 0 warnings;
the 37 remaining warnings are pre-existing `no-console` in `scripts/migrations` and
`scripts/validation`, which are CLI tools) · `npx vitest run` **473 passed / 45 files**
(was 444) · `npx next build` succeeds.

No Payload, no Stripe, no feature flags, no new runtime dependencies. Auth, checkout,
media serving and admin CRUD are untouched except where listed.

---

## 1. Branding

- **`src/app/constants/brand.ts`** is the single source of the name, tagline, description,
  contact details, navigation, footer columns, the four promises and the testimonials.
  Nothing hard-codes "Tech Haven" twice.
- New `Logo` component (supplied `logo-black.svg` / `logo-white.svg`, light and dark variants).
- **Header** rebuilt: sticky, primary nav with active-state and `aria-current`, search box,
  account link, cart with a live item-count badge, mobile drawer with body-scroll lock,
  Escape-to-close and close-on-navigate. Desktop and mobile render the same `PRIMARY_NAV`
  list, so they cannot describe different shops.
- **Footer** rebuilt: four promises, brand column with a real `<address>`, three link
  columns, newsletter, copyright, social icons, "Secure payments by Paynow".
- Design system in `_css/brand.scss` (indigo brand ramp, amber accent, neutrals, 4px spacing
  scale, radii, shadows, motion token, focus tokens) with a full dark-mode override, plus
  `_css/utilities.scss` placeholders. The admin reuses the same tokens.

## 2. Homepage

Rebuilt as a fixed composition (`src/app/(pages)/[slug]/page.tsx` home branch), so a fresh
install with an empty `pages` collection still gets a real homepage:

hero (supplied `brand/hero-1.png` + `hero-2.png`) → featured categories → new arrivals →
Deals of the Month → best-value row → testimonials → newsletter. Any layout blocks an editor
adds to the `home` page render beneath, rather than being ignored.

- **Deals of the Month** — image floated right with copy wrapping around it (a float, not a
  grid column, which is what the brief describes); becomes a normal block below the mid
  breakpoint. The countdown now counts to the **end of the current month** — the old one
  counted to "three days from whenever you loaded the page", which is not a deadline.
- The hero's second image is dropped entirely below the large breakpoint, so a phone
  downloads one image, not two. Both carry explicit intrinsic dimensions.

## 3. Product experience

- **Card** rebuilt: hover lift, image zoom, two-line clamps, and **derived badges** —
  `Sale` (a compare-at price genuinely higher than the current one), `New` (created within
  30 days), `Unavailable` (no price, which is how this codebase already represents
  "not purchasable"). Derived, never stored, so a badge cannot contradict the price under it.
- **Price** renders the struck-through previous price and a "Save N%" pill, with a visually
  hidden "reduced from" so a screen reader does not hear two bare numbers. It re-checks that
  the compare-at price is higher **and in the same currency** — a false discount claim is
  dropped rather than rendered.
- `compareAtPrice` and `createdAt` threaded through the storefront view model and both
  product adapters (`toStorefrontCompareAtPrice` applies the "strictly higher" rule once).
- **Product page**: the product's own body copy now renders (it previously never did), and
  the related-products row is only rendered when there is something in it.
- `generateStaticParams` on both dynamic routes returned bare slug strings instead of
  `{ slug }` objects — fixed.

## 4. Navigation, search and filtering

The nav links `?category=laptops`, but the filter system works in Mongo ids. Rather than add
a slug column and a migration, `_utilities/categorySlug.ts` **derives** a URL token from the
category title and `/api/products` accepts either form; ids stay canonical, so renaming a
category can never break the checkbox filters. 14 unit tests.

- **Header search** now works: `?q=` reaches a new `search` filter on `ProductListFilter`,
  implemented in the Mongo repository (term **regex-escaped** — an unescaped user string is
  both a crash and a catastrophic-backtracking DoS against every document) and in the fake.
  Capped at 80 characters.
- New `FilterSync` makes the **URL the source of truth**: deep links, bookmarks and the back
  button all produce the listing they promise.
- A category filter that resolves to nothing returns an **empty page**, not the whole
  catalogue — a URL typo must not silently look like a match.
- Skeleton tiles instead of a spinner (the grid keeps its height), a real empty state, a
  retryable error state, and a polite live region announcing the result count.

## 5. Admin UI

- New `_components/admin.module.scss` — the admin was entirely inline styles. It reuses the
  storefront tokens, so it gets dark mode for free.
- Shell with sticky top bar, brand lockup, signed-in identity, "View store", and a
  horizontally scrolling section nav with `aria-current` (eight items wrapping to three rows
  pushed content off a phone).
- **Dashboard** with real stats: published products, products with no price, orders awaiting
  fulfilment, media missing alt text. Counts are labelled `200+` when the list hit its cap
  rather than printing a capped number as if it were exact; a failed read hides the stats,
  not the page.
- Tables: proper header/row styling, hover and selected states, badge components, an
  `overflow-x` wrapper so a wide table scrolls itself instead of the document, and per-column
  warnings (`Not for sale`, `No alt text`, `Missing` image) that surface data problems.

## 6. Bulk actions

Four admin-only endpoints, each gated by `requireAdmin()` before the body is read (the
existing static authorization test covers them and still passes):

| Endpoint | Actions |
|---|---|
| `POST /api/admin/products/bulk` | publish, unpublish, delete |
| `POST /api/admin/categories/bulk` | delete (refused while products are filed under it) |
| `POST /api/admin/media/bulk` | delete (also removes the file from disk) |
| `POST /api/admin/orders/bulk` | `PROCESSING`, `FULFILLED`, `CANCELLED`, `REFUNDED` |

Design decisions, all documented in `_shared/bulk.ts`:

- Each item goes through the **same single-record mutation** the rest of the admin uses — not
  one wide `updateMany`. Slower, and correct: every validation rule (empty-category check,
  legal order transition, file removal) lives in those mutations and a bulk query would
  bypass all of them.
- **Sequential**, not `Promise.all` — fanning fifty writes at a request-sized pool takes the
  storefront down with it.
- One failure never aborts the batch and never fails the request. The response is a
  **per-item report**, so the UI says "9 published, 1 failed: Laptops — this category still
  has products in it". Unexpected errors are logged server-side and reported generically, so
  internals never reach the client.
- Batch capped at 100, ids validated and de-duplicated.
- `PAID` is deliberately **not** an order action: only the Paynow callback is authoritative
  about whether money arrived.
- **No undo**, by design — it would mean soft-deleting everything, or "restoring" a media file
  already removed from disk. Destructive actions confirm with the count and say so; nothing
  else confirms, because a confirmation on a reversible action trains people to dismiss them.

11 unit tests cover the envelope and the runner.

## 7. Content and SEO

- All template copy replaced. `mergeOpenGraph` and `generateMeta` now read the brand
  constants (was `siteName: 'Store'`); root layout has a title template, description,
  Twitter card and OG image with dimensions and alt text.
- New **`src/app/robots.ts`** — crawling only when `NEXT_PUBLIC_IS_LIVE` is set (matching the
  `X-Robots-Tag` header `next.config.js` already sets), with admin/API/account/checkout
  disallowed.
- New **`src/app/sitemap.ts`** — published pages and products through the same repositories
  the storefront uses, so a draft can never be listed. A failed read degrades to the static
  routes rather than 500ing, which would make a crawler back off the whole site.
- Fallback home/cart copy rebranded.

## 8. Media and the catalogue

- Supplied images placed: logos, favicon, social icons, `brand/hero-*.png`, and 21 files in
  `public/media/` (6 category images, 15 product shots).
- New **`npm run seed:store`** (`scripts/seed/seedStore.ts` + `catalogue.ts`) creates the
  media records, six categories, fifteen published products with real copy and prices, the
  home/products/cart pages and the globals. Idempotent: it fills gaps by default and only
  rewrites existing documents under `SEED_OVERWRITE=true`, so an owner's edits survive a
  second run. It **validates the catalogue before writing anything** — every image must exist
  on disk, every alt text must be non-empty, every `compareAtPrice` must be strictly above its
  price, and relations must resolve. Prices are integers in minor units throughout.
- Media records carry the real width/height read from the files, so `next/image` reserves
  layout space before the bytes arrive.

## 9. Smaller things

- Toast system (`_providers/Toast`) with separate polite and assertive live regions, a capped
  stack, and longer dwell for errors. Wired into the provider tree and used by the bulk bar.
- Shared `EmptyState` component — one voice for "nothing here" and "that failed", each with
  exactly one way forward.
- `BackToTop`: appears after ~900px, `rAF`-throttled passive listener, removed from the DOM
  rather than hidden (so it is never an invisible tab stop), honours `prefers-reduced-motion`,
  44px target, and returns focus to the top of the document.
- Skip-to-content link as the first tab stop.
- **Focus-indicator bug found and fixed**: `--th-focus-ring` is a `box-shadow` value but three
  components used it as `outline`, which silently produces *no* focus indicator. Split into
  `--th-focus-ring` (box-shadow) and `--th-focus-outline` (outline), named for the property
  they belong in.
- Global keyframes moved out of `utilities.scss` into `app.scss` — that file is forwarded into
  every CSS module, so a `@keyframes` block in it was emitted dozens of times.

---

## Images: all used

All 21 files in `public/media/`, both hero shots, both logos, the favicon, the three social
icons and the four inclusion icons are referenced. Nothing was left out.

Two notes on assets I did **not** add:

- `public/assets/icons/hand.png` and several arrow/UI icons were already in the template and
  remain unused by the new components. They are pre-existing and harmless; I left them rather
  than delete assets you may still want.
- `public/static-image.jpg` is used as the Open Graph card. It is the supplied image, but it is
  a photograph rather than a designed 1200×630 social card — worth replacing before launch.

## Before you launch

1. **Run the seed**: `npm run seed:store` (then `npm run seed:admin` if you have not already).
   Without it the storefront is correct but empty.
2. **Edit the contact details** in `src/app/constants/brand.ts` — the email, phone and address
   are marked placeholders and currently point at `techhaven.example`.
3. The **newsletter form is honest but not wired**: it validates and stores to `localStorage`,
   and says so. Point it at a real provider before you promise anyone an email.
4. `NEXT_PUBLIC_IS_LIVE` must be set in production or robots.txt will disallow everything.
5. **The one real gap**: there is still no MongoDB in this environment, so repository-layer
   Mongoose queries — including the new `search` regex filter and the bulk mutations against a
   real database — are covered by fakes but never executed against Mongo. Run the bulk actions
   and a search against your local database before you ship.
