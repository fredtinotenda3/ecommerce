# Terro Technology — rebrand implementation report

`terro-technology-changed-files.zip` — 50 changed/new files (7.0 MB, dominated by one 5.6 MB video).
21 stale Tech Haven media files were deleted outright (list in "Cleanup" below) rather than zipped, since a deletion isn't a file to ship.

**Verified:** `tsc --noEmit` clean · `eslint src` clean (0 errors) · `vitest` **481 passed / 46 files** · `next build` succeeds, 29/29 routes generated (Google Fonts and MongoDB both unreachable in this sandbox — see "Verification" below for exactly how each was worked around, and what still needs a real database to confirm).

Full detail lives in three docs shipped inside the zip:
`docs/terro-technology-setup.md` (setup, pricing sourcing, every placeholder Terro must still supply),
`docs/image-polish-prompts.md` (every one of the 24 supplied images and the video, asset-by-asset),
`docs/image-generation-prompts.md` (the one real imagery gap — Laptops & Computers).
This report is the narrative summary; those three are the reference.

---

## What this was

A full rebrand of an existing, working Next.js + MongoDB + Paynow storefront from a fictional
placeholder brand ("Tech Haven") to a real client business, Terro Technology — a Harare smartphone,
computer and gaming-PC retailer that also repairs devices, using only the client's own supplied
flyers, logo files and one promotional video as source material. No architecture changed: same
Mongoose models, same Paynow checkout, same admin panel, same test suite. The brief was explicit that
this is a rename-and-recontent job on top of working software, not a rebuild, and that inventing any
business fact not actually supplied — a warranty term, a delivery fee, a customer testimonial — would
be worse than an honest gap. That constraint shaped most of the real decisions below.

## Brand system

**Colour.** The brief specified "Deep Electric Cobalt" as a tonal family, not a single hex value, and
warned explicitly against turning the whole site blue. The four reference hexes it gave
(`#0755C9` / `#123E9B` / `#1769E8` / `#082B73`) were cross-checked against real pixel samples pulled
from Terro's own logo and flyers before being trusted — they matched closely, so they were used as
given rather than second-guessed or substituted. They became a nine-step scale
(`--th-brand-50`…`--th-brand-900`) replacing the old tokens in `src/app/_css/brand.scss`, for both the
light and dark themes, with neutrals, semantic colours and the existing amber "deals" accent left
untouched. Every text/fill pairing was run through a WCAG contrast calculation before being finalised —
the dark-theme button fill failed at 4.00:1 on the first pass and was moved to `#2E68CF` (5.25:1).

**Logo.** Extracted from the client's own JPEG via alpha masking (distance-from-white, then
despeckled) rather than redrawn from scratch. The wordmark is live text, not a second image — a
deliberate simplification over Tech Haven's two-image light/dark swap, since Terro's real icon reads
fine on either background alone.

**Favicon / OG image.** Multi-size `.ico`, an SVG wrapping the same PNG as base64 (no vector-tracing
tool was available — flagged as a known limitation, with a redraw prompt in the polish-prompts doc),
and a custom-composed 1200×630 OG card (no single supplied photo is both on-brand and landscape enough
for one).

## Asset audit

All 24 supplied JPEGs and the one MP4 were opened, measured, and their corners scanned for
watermarks before any placement decision — including, this session, 11 images a prior pass had not
yet individually logged (`cracked-phone-case.jpeg`, both `laptop(s)-covers.jpeg` exports, `laptop.jpeg`,
`latest-laptops-discover.jpeg`, `macbook.jpeg`, `phone-service.jpeg`, `preloved-smart-phones.jpeg`,
`summer-deals.jpeg`, `winter-deals.jpeg`). One file, `laptop2.jpeg`, carries a faint third-party
stock-photo watermark in its corner and is excluded from use entirely. Two more real product photos
came out of this closer pass and are now live: a repair-bench photo (`warranty-repair-bench.jpg`, on
the Warranty & repairs page) and an opened all-in-one desktop (`about-repair-detail.jpg`, on the About
page) — both pages previously shipped as plain text with no image at all. Full per-asset reasoning,
including the seven images reviewed and deliberately not used, is in `docs/image-polish-prompts.md`.

**The one real gap**: Laptops & Computers has zero product photos. Nothing supplied is a clean,
unwatermarked photo of a whole sellable laptop — the closest candidates are repair-context shots,
the excluded watermarked file, or stock-composite marketing collages. Rather than force a mismatched
image onto a real price, the category ships honest about the gap ("Photographed listings are on their
way") and `docs/image-generation-prompts.md` gives three ready-to-use prompts for interim placeholder
photography, with an explicit note that generated images should be swapped for real photos before any
of those listings goes live with a real price.

## The video

`terro-video.mp4` (portrait, 39.5s, has its own audio track) was first considered for the homepage
"Deals of the month" slot, per the original plan. Sampling its frames this session showed it's
actually a services-overview reel — Networking, Programming, CCTV Installation, Sales & Accessories,
Cellphones, then a contact card — not deal-specific content at all, so it moved to the Services page
instead, where it matches exactly. It's embedded as a native `<video controls>` element: click-to-play,
not autoplay, not muted, because it carries real narration rather than being a silent loop. A poster
frame was sampled from the clip itself (eight candidates tried; a legible "Cellphones" frame was
used). **Captions are not yet in place** — `openai-whisper` was installed specifically to transcribe
the audio properly, but its model download comes from a host this sandbox's network policy blocks, and
there is no way to fabricate an accurate transcript. A factual description of the video's visible
content ships in its place; the real fix is Terro supplying or approving a transcript before launch
(a genuine WCAG 1.2.2 gap, called out again in the setup doc).

## Catalogue

Five categories, eight products. Two prices (iPhone 15 Pro 256GB, Samsung Galaxy S23 Ultra 256GB) are
transcribed from Terro's own flyers and were independently re-verified against the source images while
writing this report — both matched exactly. The other six are explicitly flagged in code and in the
setup doc as estimates needing confirmation before real sales. No product carries a `compareAtPrice`
anywhere — no supplied asset states a "was" price, so none was invented. Zero products were force-fit
into Laptops & Computers for the reason above.

## Honesty pass — claims removed, not just renamed

Beyond swapping the name, this pass found and removed several specific claims the previous build made
that nothing Terro supplied backs up: "free delivery over $150," "two-year warranty," "30-day returns"
(in two separate places — the product page and the cart page), "ships within one working day" (in two
separate places — the product page and the empty-cart message), "all in stock today," a stale "six
categories" count now that there are five, and — found only during this session's final sweep — a 404
page recommending a nonexistent `?category=laptops` link labelled "MacBooks" and a footer-style "we
answer six days a week" claim, plus a dead, unused `inclusions` export in `constants/index.ts` still
carrying a fabricated "Money Guarantee." All of it is gone or replaced with something the business
actually states; the full before/after table is in the setup doc.

## Cleanup

21 image files left over from the Tech Haven catalogue (product PNGs like
`14-inch-macbook-pro-12-core-1tb-space-black.png`, old category art, three unused hero PNGs in
`public/brand/`) were confirmed unreferenced anywhere in `src/`, `scripts/`, or `tests/` — by name,
individually — and deleted rather than left to accumulate as dead weight in the delivered codebase.

## Verification

- `npx tsc --noEmit`, `npx eslint src`, `npx vitest run` — all clean, all 481 pre-existing tests still
  pass (checkout, cart accessibility, compare-at-price rules, admin bulk actions — everything the
  brief said not to break).
- `npm run build` — succeeds, 29/29 routes generated. Two sandbox limitations required a workaround,
  both fully reverted afterward: `next/font/google`'s `Jost` import was temporarily stubbed to a local
  shim so the build didn't need `fonts.gstatic.com` (blocked here), and `DATABASE_URI` is unset in this
  sandbox, which surfaces as caught, logged errors on the pages that read header/footer content at
  build time — exactly the fallback path those pages are designed to take with no database, confirmed
  by reading the relevant `try/catch` in `[slug]/page.tsx`, not a build failure.
- `scripts/seed/seedStore.ts`'s own `validateCatalogue()` — exercised directly; it checks every media
  reference, category slug derivation, and (a check added this session) every page's hero-media
  reference before allowing a write, and passes clean.
- Not performed: an actual rendered page against a live database, since none is available here. The
  two pages whose hero layout changed this session (`about`, `warranty`, now `mediumImpact` instead of
  plain text) were verified by reading `MediumImpactHero`'s exact prop contract and matching the seed
  data to it field-for-field, plus the existing adapter tests that already cover `mediumImpact` media
  resolution. Recommended before announcing the store: seed a real database and click through every
  page once.

## What Terro still needs to supply

Business hours, a production domain, live Paynow credentials, a delivery fee (if any), a written
warranty term (if any beyond "the manufacturer's standard cover"), confirmation of the six estimated
prices, real laptop product photography, a transcript for the services video, and real customer
testimonials if they want that section to appear. Every one of these is a placeholder in the code
today, clearly marked as one — none of them was guessed at. Full list with exactly where each lives in
the code: `docs/terro-technology-setup.md`, §8.
