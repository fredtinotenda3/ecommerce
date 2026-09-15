# Terro Technology — rebrand notes and launch setup

This document covers what changed in this rebrand, how to stand the store
up from scratch, and — most importantly — the exact list of things Terro
needs to confirm or supply before this goes live for real customers.
Nothing below invents a business fact; every placeholder is named as one.

The platform underneath is unchanged: Next.js (App Router) + MongoDB via
Mongoose + Paynow for payment. No Payload, no Stripe, no new architecture.
This was a rebrand and a content rebuild, not a rewrite.

## 1. What changed

- **Brand identity.** "Tech Haven" is gone from every customer- and
  admin-facing surface (logo, favicon, Open Graph image, page titles, nav,
  footer, admin top bar, fallback pages, cart/product trust copy). A
  handful of source-code comments still say "Tech Haven" where they explain
  a past decision (e.g. why a media MIME-type bug existed) — those are
  accurate history, not branding, and were left alone deliberately.
- **Colour system.** The brand tokens in `src/app/_css/brand.scss`
  (`--th-brand-50` … `--th-brand-900`, plus `--th-brand-text`,
  `--th-brand-fill`, `--th-brand-fill-hover`) were replaced with a Deep
  Electric Cobalt tonal scale sampled from Terro's own supplied flyers and
  logo (`#0755C9` primary, `#123E9B` deep, `#1769E8` highlight, `#082B73`
  anchor), for both the light and dark themes. Every pairing was checked
  against WCAG 2.1 AA contrast (4.5:1 for text) with a small Python
  luminance/contrast script before being finalised — the dark-theme button
  fill in particular was moved from an initial `#3D7CE8` (4.00:1, failing)
  to `#2E68CF` (5.25:1). Nothing else in the token file changed: neutrals,
  semantic colours (success/warning/danger) and the existing amber accent
  are untouched, so the whole site did not become a wash of blue.
- **Logo.** `_components/Logo` now draws the real Terro shield icon
  (extracted from the client's own logo file) and sets "Terro Technology"
  as live text rather than a second image, so it follows the light/dark
  theme automatically. See `docs/image-polish-prompts.md` for the
  extraction method and why this is a simplification, not a regression.
- **Catalogue.** Five categories (Smartphones, Laptops & Computers, Gaming,
  Accessories & Parts, Printers & Office Tech) and eight published products,
  built from real supplied imagery and — where Terro's own flyers show a
  number — real prices. See §3 below for exactly which prices are
  confirmed vs. estimated.
- **Content pages.** `about`, `contact`, `delivery-and-returns`, `warranty`
  (retitled "Warranty & repairs"), and two new pages this rebrand added —
  `services` ("Repairs & services") and `faq` — all carry Terro-specific
  copy with no invented policy numbers. The `warranty` and `about` pages
  each carry a real photograph (a repair bench, an opened all-in-one); the
  `services` page carries Terro's own animated services-overview clip,
  click-to-play. See §4.
- **Homepage.** Hero, category tiles, new arrivals, a custom-gaming-PC
  spotlight (replacing the old "Deals of the month" discount countdown —
  see §5 for why), a why-us band, and a newsletter band. Testimonials are
  configured but empty (§6).
- **Honesty pass.** Beyond the rename, this rebuild removed several
  specific claims the previous (Tech Haven) build made that nothing
  supplied by Terro supports: "free delivery over $150," "two-year
  warranty," "30-day returns," "ships within one working day," "all in
  stock today," and a dead `inclusions` export carrying a fabricated "Money
  Guarantee." None of these are Terro claims — see §7 for the full list of
  what replaced them and why.

## 2. Standing up a fresh environment

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URI` — a MongoDB connection string.
   - `SESSION_SECRET` — generate with
     `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
     Rotating this invalidates every issued session.
   - `NEXT_PUBLIC_SERVER_URL` — the real public origin once one exists (see
     §8 — this is currently unset).
   - `PAYNOW_INTEGRATION_ID` / `PAYNOW_INTEGRATION_KEY` / `PAYNOW_MODE` —
     Terro's own Paynow merchant credentials. Leave `PAYNOW_MODE=test`
     until those are live credentials, not sandbox ones — see §8.
   - `MEDIA_DIR` — a persistent volume path in production. The seeded
     images ship inside `public/media/` and are served from there in
     development (`src/lib/media/storage.ts` falls back to that directory
     when a file isn't in `MEDIA_DIR`), but any *new* upload through the
     admin UI in production needs `MEDIA_DIR` pointed at real persistent
     storage, not a container's ephemeral filesystem.
2. Install dependencies and run the app once (`npm install`, `npm run
   dev`) so the database connection and models initialise.
3. Create the first administrator:
   ```
   ADMIN_EMAIL=you@terro.example ADMIN_PASSWORD='a-strong-password' npm run seed:admin
   ```
   This is the only way to create the first admin — self-registration
   always produces a customer account. Once one admin exists, promote
   further admins from `/admin/customers`.
4. Seed the storefront catalogue:
   ```
   npm run seed:store
   ```
   This is idempotent and safe to re-run: it only fills in what's missing
   unless `SEED_OVERWRITE=true` is set, in which case seeded fields are
   refreshed and anything an editor has since changed by hand on a *seeded*
   field is overwritten (custom additions — new products, new pages — are
   never touched either way). The script validates the whole catalogue
   (slugs, media references, prices, page hero-media references) before
   writing anything, and refuses to write if it finds an inconsistency.
5. Sign in at `/admin` with the account from step 3 and review the seeded
   categories, products and pages before announcing the store publicly.

## 3. Catalogue pricing — what's confirmed vs. estimated

Every price below is an integer in cents; the table gives the display
figure. See `scripts/seed/catalogue.ts` for the full sourcing comment on
each.

| Product | Price | Source |
|---|---|---|
| iPhone 15 Pro, 256GB, Natural Titanium | $1,200 | `boxed-iphones.jpeg` price list |
| Samsung Galaxy S23 Ultra, 256GB | $630 | `brand-new-samsung.jpeg` price list |
| Huawei P60 Pro, 256GB | $520 | **Estimated** — no supplied flyer prices Huawei |
| Preloved iPhone X, 64GB | $190 | **Estimated**, anchored below the $220 boxed-X price on `boxed-iphones.jpeg` |
| Custom Gaming PC — Ryzen 5 / RTX Build | $650 | **Estimated** starting price — the product copy itself says this is quote-based |
| Laptop & Desktop SSD, 128GB–512GB | $24 | **Estimated** (256GB tier) |
| Universal Laptop Charger | $18 | **Estimated** |
| Home & Office Inkjet Printer | $140 | **Estimated** |

**Do not treat the estimated prices as safe to sell at without checking
them first.** They were set at a plausible Zimbabwe retail level for their
category, not derived from anything Terro supplied. The two sourced prices
(iPhone 15 Pro, Galaxy S23 Ultra) were independently re-verified against
the original flyer images while writing this document.

The full Samsung S-series list on `brand-new-samsung.jpeg` (S20 F.E through
S25 Ultra, ten SKUs with real prices from $190 to $1,150) and the full
iPhone list on `boxed-iphones.jpeg` (iPhone X through 15 Pro Max, eighteen
SKUs from $220 to $1,300) go further than the eight products currently
seeded — only one SKU from each flyer became a listing, matched to the one
product photo available for each. If Terro wants the rest of either list
turned into real listings, the prices are already sitting in those two
source images; the missing piece per SKU is a photo of that specific
device, not a price.

## 4. Content pages and the video

- `about` and `warranty` (Warranty & repairs) each render as a
  `mediumImpact` hero — heading, body copy, and a real photograph — instead
  of the plain text-only hero every other page uses. This required no new
  component: `mediumImpact` already existed and was already covered by
  this project's own adapter tests, just unused by any seeded page before
  now.
- `services` (Repairs & services) carries Terro's own animated
  services-overview clip (`terro-video.mp4`, supplied), embedded as a
  native `<video controls>` element — click-to-play, not autoplay, and not
  muted. It was first considered for the homepage's "Deals of the month"
  slot; sampling its frames during the asset audit showed it is a
  services-overview reel (Networking, Programming, CCTV Installation,
  Sales & Accessories, Cellphones, then a contact card), not deal- or
  discount-specific content, so it was moved to the page it actually
  matches. See `_components/Services/ServicesVideo` for the full reasoning
  in code.
  - **Captions**: this environment could not produce a real transcript of
    the clip's spoken audio. `openai-whisper` was installed to do it
    properly, but its model download is served from a host this sandbox's
    network policy blocks; there was no way to generate an accurate
    transcript without inventing one, and a fabricated transcript is worse
    than none. What ships instead is a factual text description of what
    the video visibly shows (confirmed by sampling its frames, not
    guessed). **Before this goes live, get Terro to either supply the
    clip's original script or approve a transcript someone actually
    listens to and writes down**, and add it as a `<track kind="captions">`
    on the `<video>` element in `ServicesVideo/index.tsx` — this is a
    genuine accessibility gap (WCAG 1.2.2) as it ships today, not a
    stylistic nicety.

## 5. Why "Deals of the month" became a Custom Gaming PC spotlight

The original (Tech Haven) version of this homepage band counted down to
"up to 15% off selected MacBooks and iPhones," against a product (a 14-inch
MacBook Pro) that isn't even in this catalogue. Nothing supplied by Terro
states a "was" price for anything, so an honest countdown to a real
discount isn't possible with the data available — inventing one is exactly
what the brief says not to do. Rather than re-point the same mechanic at a
different fake number, the countdown is gone, and the band now spotlights
the one catalogue item that's genuinely quote-based on its own terms: the
custom gaming PC build. The component and file are still named `Deals` to
avoid unnecessary churn to the homepage composition.

## 6. Testimonials

`constants/brand.ts` exports an empty `TESTIMONIALS` array, and the
`Testimonials` component already renders nothing at all when it's empty —
this is the correct behaviour, not a bug to fix. No supplied asset includes
a customer quote, and inventing one for a real, named business is not
something this project will do. When Terro has real customer quotes (with
permission to publish them, and ideally a first name and a general area
rather than a full name), add them to that array and the homepage section
appears automatically.

## 7. Every invented claim this rebuild removed, and what replaced it

| Removed | Where | Replaced with |
|---|---|---|
| "Free delivery over $150" | Product page trust badges | Terro's own four `INCLUSIONS` (boxed & preloved stock, repairs & accessories, Paynow, message us directly) — the product page now reads the same list the rest of the site does, instead of carrying its own separate, drifted-from-reality list |
| "Two-year warranty" | Product page trust badges | (same fix as above) |
| "30-day returns" (×2 — product page and cart page) | Product hero, cart trust row | Cart: "Free collection from our Harare shop" (matches the Delivery & returns page copy) |
| "Available to order — ships within one working day" | Product page availability line | "Available to order" (no turnaround claim) |
| "Everything in stock ships within one working day" | Empty-cart message | "Have a look through the shop and add what you need" |
| "The most recent additions to the shop, all in stock today" | Homepage new-arrivals lede | "The most recent additions to the shop." (the app has no stock model at all — see `ProductHero`'s own comment — so a blanket availability claim isn't something the system can back up) |
| "Six categories, everything in stock and ready to ship the same day" | Featured-categories lede | "Smartphones, computers, gaming and the accessories and repairs that keep them running." (also fixes a stale count — the catalogue has five categories, not six) |
| A dead `inclusions` export: "Free Shipping... above $150," a 30-day "Money Guarantee," "Online Support 24 hours a day" | `constants/index.ts` | Removed outright — unused anywhere in the app, so there was nothing to rebrand, only to delete |

## 8. Everything Terro still needs to supply or confirm

Nothing below blocks the code from running — the site works today with
honest, hedged copy in every one of these spots. These are the business
facts a real launch needs:

1. **Business hours.** `CONTACT.hours` in `constants/brand.ts` currently
   reads "Contact us on WhatsApp to confirm today's hours" — no supplied
   asset states real opening hours.
2. **A production domain.** `NEXT_PUBLIC_SERVER_URL` is unset. This affects
   Open Graph image URLs, Paynow's return/result URL derivation, and the
   site's indexability switch (`NEXT_PUBLIC_IS_LIVE`) — none of these are
   fully correct until a real domain exists.
3. **Live Paynow credentials.** `PAYNOW_MODE` must stay `test` until Terro
   has (or gets) a real Paynow merchant account and its live integration ID
   and key.
4. **A delivery fee and area, if any.** The Delivery & returns page
   deliberately does not quote a number — it asks customers to confirm on
   WhatsApp instead. If Terro wants a published number or flat fee, provide
   it and the copy can be tightened.
5. **A written warranty term, if any beyond "the manufacturer's standard
   cover."** Same reasoning as above.
6. **Confirmation of the six estimated prices** in §3, before they're
   trusted for real transactions.
7. **Laptops & Computers product photography** (or approval to use
   generated placeholder imagery in the interim) — see
   `docs/image-generation-prompts.md`.
8. **A real transcript of `terro-video.mp4`'s audio**, for accessibility
   captions — see §4.
9. **Real customer testimonials**, with permission to publish — see §6.
10. **A second WhatsApp deep link, if wanted.** Both phone numbers on
    Terro's flyers double as WhatsApp lines; only the primary
    (`+263 77 381 8274`) is wired as a `wa.me` link anywhere on the site.
    The secondary number is shown as text on the Contact page.

## 9. Verification performed this rebuild

- `npx tsc --noEmit` — clean.
- `npx eslint src` — clean (0 errors; the project's lint script does not
  cover `scripts/`, where a handful of pre-existing, unrelated warnings
  live in migration/validation scripts this rebuild did not touch).
- `npx vitest run` — all 46 test files / 481 tests pass, including the
  pre-existing compare-at-price, checkout, cart-accessibility and admin
  bulk-action suites this rebrand was required not to break.
- `scripts/seed/seedStore.ts`'s own `validateCatalogue()` — checked
  directly (via `npx tsx scripts/seed/seedStore.ts`, which runs validation
  before attempting a database connection): the catalogue, including the
  two new page hero-media references added this session, is internally
  consistent.
- `npm run build` — compiles successfully and generates all 29 routes
  (static and server-rendered). This sandbox has no MongoDB and no route to
  the Google Fonts host `next/font` needs at build time, so the build was
  run with `next/font/google`'s `Jost` import temporarily stubbed out
  (reverted immediately after — `src/app/layout.tsx` ships with the real
  Google Fonts import, unchanged) and produced the expected, gracefully
  handled "DATABASE_URI is not set" errors for the pages that read header
  and footer content at build time — exactly the fallback behaviour
  `[slug]/page.tsx` and `generateStaticParams` are designed to have with no
  database, not a build failure.
- **Not performed**: a rendered visual check against a live MongoDB (this
  sandbox has none). The two pages whose hero variant changed this session
  (`about`, `warranty`) were instead verified by reading `MediumImpactHero`'s
  exact prop contract and confirming the seed data matches it field for
  field, plus the adapter-level tests already covering `mediumImpact` hero
  resolution. Before announcing the store publicly, seed a real database
  and load every page (home, a product, a category filter, cart, checkout,
  `about`, `warranty`, `services`, `faq`, `contact`,
  `delivery-and-returns`) at least once.

## 10. Known limitations

- The favicon is a raster PNG wrapped in an SVG document, not a true
  vector trace (no vector-tracing tool was available in this environment).
  See `docs/image-polish-prompts.md` for a redraw prompt if Terro wants one.
- `MediumImpactHero` (used by the `about` and `warranty` pages) uses an
  older CSS token set (`--base`, `--gutter-h`, `--theme-elevation-100`)
  rather than the `--th-*` brand tokens the rest of the rebrand uses. It is
  fully functional and themes correctly in both light and dark mode — those
  variables are all defined — but it was not visually restyled to match the
  bespoke homepage bands. This is a legitimate, already-tested part of the
  app reused as-is, not a new component, and matching its visual polish to
  the rest of the site is a reasonable follow-up, not a blocker.
- Laptops & Computers has zero products (see §8, item 7).
