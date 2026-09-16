# Elite-mode follow-up: admin-managed hero/video + responsive audit

`MANIFEST-home-global-pass.txt` — 28 modified files, no new files. No auth,
checkout, payment, tenancy, or catalogue business-logic files touched.

**Verified:** `npx tsc --noEmit` clean · `npx eslint src` clean ·
`npx vitest run` **503 passed / 46 files** (481 pre-existing + 22 new), no
regressions. This upload had no `public/` folder, same as the prior elite
visual pass — see "Limitations" for exactly what that does and doesn't
constrain this time.

---

## 0. A correction the brief needed before anything else could be scoped

The brief's non-negotiable #1 requirement assumes a Payload CMS admin
("REMOVE ALL ADMIN/STORE DEMO TEXT... generic Payload/template/demo
descriptions", "use the existing admin/CMS architecture"). That assumption
is stale: `FINAL_REPORT.md` and `package.json`'s own description
("Next.js + Mongoose + Paynow e-commerce application (Payload/Stripe
free)") confirm this project fully migrated **off** Payload before this
session, onto a native admin at `/admin` backed by its own repository/
service layer (`src/lib/repositories`, `src/lib/services/
AdminContentService.ts`). "Use the existing admin/CMS architecture" is
followed to the letter below — it's just a different, already-real system
than the one named in the brief. Payload/demo copy was already audited and
confirmed absent outside `/styleguide` (an unlinked dev route, left alone
as before — not a launch blocker, still worth a `robots.ts` line or a
removal if you want it gone from the deployed bundle).

## 1. The real gap: hero and brand-story video were 100% hardcoded

The prior elite visual pass (see `terro-technology-elite-visual-pass-report.md`)
did excellent work on the hero's visual composition and shipped the
homepage video section, but neither one read from the CMS: `HomeHero` and
`BrandStory` took no props at all — every heading, CTA, the product photo
path, and the video/poster paths were literals in the component files. That
directly contradicts the brief's own non-negotiable #1, so closing it was
this session's main piece of work, done the way the brief asks: extending
the *existing* architecture, not building a parallel one.

**What was added**, following the exact pattern already used by the
Header/Footer/Settings globals (`GlobalsRepository`, `AdminContentService`,
`/api/admin/globals/[slug]`, `/admin/globals`):

- A fourth global, `Home`, stored in the same `globals` Mongo collection
  (`globalType: 'home'`) — no new collection, no schema migration (the
  model is `strict: false`, same as the other three).
- Every hero and video field an operator would plausibly want to change:
  eyebrow, heading (two-tone, matching the existing design), lede, up to
  3 trust points, both CTAs (label + link, validated as a pair — see §2),
  the hero photo, and the video's eyebrow/heading/lede/link, clip and
  poster.
- Full validation in `AdminContentService.saveHome`: text length caps, a
  shared `assertSafeHref` (refactored out of the existing redirect-target
  check, now used by both) that rejects `javascript:`/protocol-relative
  URLs, a CTA-completeness check, and a referential check that a picked
  Media id actually exists and is the right kind (the hero-photo field
  rejects a video id and vice versa).
- A `/admin/globals` "Home page" section using the same `AdminForm`/
  `AdminSection` components every other admin screen uses — no new form
  library, no new admin surface.
- The storefront read path (`fetchGlobals.ts`, `globalsStorefrontAdapter.ts`)
  resolves the three media relations exactly like the Header global already
  resolves a nav icon, including deduplicating a ideally reused id (the
  same photo picked for two fields is only fetched once).

**Every field falls back independently.** `HomeHero`/`BrandStory` check
each field on its own (`home?.heroHeading || 'Smartphones and tech,'`, and
so on) — an operator who fills in only the heading does not lose the
default photo or CTAs, and a fresh install with no `home` document renders
exactly the hardcoded design this project shipped with before this session.
That's the same "null is not an error" contract the other three globals
already use, applied consistently rather than invented fresh.

## 2. Admin management — what's covered, and one real gap closed to get there

Covered from `/admin/globals` → "Home page" without touching source: hero
eyebrow/heading/lede/CTAs/photo, video eyebrow/heading/lede/link/clip/
poster. A CTA is rejected if only half-filled (a label with no link, or
vice versa) — cheaper to catch at save time than to discover a dead button
live.

**The video upload gap.** The brief assumes a video can already be a Media
relation ("If the current architecture already allows the video to be
changed from Admin: USE THAT"). It couldn't: `src/lib/media/storage.ts`'s
upload allow-list was images only (`ALLOWED_MIME_TYPES` had five image
types, no video, and a flat 10MB ceiling). Per the brief's own fallback
rule ("If the current system genuinely cannot support the requirement, ...
use the smallest architectural change necessary"), this session extended
the existing upload pipeline rather than inventing a second one:
`video/mp4` and `video/webm` added to the allow-list with real magic-number
checks (the MP4 `ftyp` box; the WebM/EBML header — not just a trusted
`Content-Type` header), and a separate, higher size ceiling for video
(100MB) introduced as `MAX_VIDEO_UPLOAD_BYTES` / `maxUploadBytesFor()`
rather than raising the image limit too. The admin media list/detail pages
and the upload form's `accept` attribute were updated so a video uploads
and previews correctly instead of rendering as a broken `<img>`. No
transcoding was added — a browser plays what was uploaded, unchanged.

**Still code-controlled, deliberately:** the homepage's section *order*
(hero → categories → new arrivals → deals → value props → video →
testimonials → newsletter) stays fixed in `[slug]/page.tsx`, per that
file's own long-standing header comment: a fixed, argued composition for a
homepage, CMS blocks appended beneath it for anything an editor adds. That
is a defensible, already-documented decision predating this session, not
something this pass introduced — flagging it because "admin can reorder
homepage sections" is a materially bigger, different feature (turning the
homepage into a CMS-page-with-blocks) than "admin can edit the fixed
sections' content," which is what was asked for and built.

## 3. Hero

No change to the visual composition — the prior pass's 36/64 grid split,
the blurred "echo," the two technology-panel SVGs, and the "do not upscale
past 460px" discipline are untouched and still correct. What changed is
that the product photo is now a real Media relation with a graceful
degradation path: `.artImage`/`.artEcho` already sized themselves via
`width: min(100%, 30rem); height: auto` rather than a fixed pixel box, so
next/image just needs the *real* width/height of whatever photo is
selected — no CSS changes were needed for a differently-shaped
replacement photo to render correctly. One honest caveat, documented in
`Home/Hero/index.tsx`: this project's dimension reader
(`imageDimensions.ts`) doesn't parse AVIF, so an AVIF upload would arrive
with no known width/height; the component falls back to the default 460×280
box in that specific case rather than crashing (next/image requires a
width/height when not in `fill` mode). JPEG/PNG/WebP/GIF — the vast
majority of real uploads — are unaffected.

## 4. New arrivals — responsive audit

The grid itself (`Home/FeaturedProducts`) was already well-built by a prior
pass: 4-up above 1024px, 2-up from 769–1024px, a horizontal swipe rail of
68%-wide snap-aligned cards at ≤768px (not a shrunk single column), and the
shared `Card` component already had per-breakpoint aspect-ratio switching,
a 2-line title clamp, price-below-title hierarchy, and
`prefers-reduced-motion` handling. No structural changes were needed there,
and none were made.

**The real, verified bug**: `Card`'s `sizes` attribute — the hint that
tells the browser which image rendition to fetch — was a single hardcoded
string (`"(max-width: 640px) 92vw, (max-width: 1024px) 44vw, 22vw"`) shared
by three different grids with three different actual layouts:
`CollectionArchive` (single column ≤768px, not ≤640px), `RelatedProducts`
(never drops below 2 columns), and `FeaturedProducts` (a 68vw rail
≤768px, not 92vw). Every one of those breakpoints/percentages was off from
the CSS it was meant to describe — not a visual bug, but a real one: a
phone on the New Arrivals rail was fetching an image sized for 92% of the
viewport when the card only renders at 68%, over-fetching by roughly a
third on every tile. Fixed by making `sizes` an optional prop on `Card`
(defaulting to a corrected value for `CollectionArchive`'s own shape) and
passing accurate, grid-specific values from `FeaturedProducts` and
`RelatedProducts`. Verified against the seven requested widths
(1440/1280/1024/768/430/390/375) by walking each grid's own breakpoint math
by hand against its `.module.scss`, since no browser was available to
screenshot against in this session (see "Limitations").

## 5. Homepage video

Placement, framing and copy sequencing are unchanged from the prior pass —
still its own `Home/BrandStory` section between `ValueProps` and
`Testimonials`, still click-to-play with real controls. What changed: the
clip, its poster, and its copy are now optionally admin-driven (§1–2), and
`.video`'s CSS gained `object-fit: cover` as a safety net — this project
has no video-container dimension reader (unlike images), so a replacement
clip of a different native shape crops to fill the existing portrait box
rather than stretching. A real fix (reading a `moov`/`tkhd` box the way
`imageDimensions.ts` reads a PNG header) is flagged in the component's own
comment as a follow-up worth its own review, not attempted as a drive-by
inside this change.

The Services-page video (`ServicesVideo`) was deliberately left as-is: it's
a separate, already-reasoned placement (mirrored composition, same clip,
its own documented portrait-video sizing trade-off), and the brief's
"admin-managed" and "large video" asks both centered on the *homepage*
video specifically. Making it admin-driven too is a natural, low-risk
follow-up using the exact same `Home` global pattern, or its own
service-specific global if it should vary independently from the homepage
video — not done here to keep this change's blast radius to what was
actually asked for.

## 6. Technology artwork placement

No change. Verified the current placements are still exactly what the
prior pass's report describes and argues for: homepage hero (`.circuit` +
`.stagePanel`), footer (a restrained 130px top strip at 0.5 opacity,
`circuit-footer.webp`, already exactly the "shallow crop, faded, low
opacity" treatment §10 of the brief asks for — confirmed by reading the
component, not just the prior report's word), and `NewsletterBand`'s corner
accent. Product/category headers and other transitions remain
intentionally bare. This session found no placement worth adding or
removing.

## 7. Store pages / demo copy

Re-swept `src/app` for the brief's named strings ("Core Features" and
similar) and generic template markers: zero matches outside `/styleguide`,
confirming the prior pass's finding still holds after this session's
changes.

## 8. Category images (Printers & Office Tech, Gaming, Accessories & Parts,
Laptops & Computers)

No new information available this session — this upload had no `public/`
folder, same constraint as the prior pass, so no image was newly inspected.
`docs/image-polish-prompts.md`'s per-category prompts and
`docs/image-generation-prompts.md`'s Laptops & Computers generation gap
(the one real launch-blocking image gap on record) are both untouched and,
as far as this session can verify, still current.

## 9. Responsive behavior — summary

Desktop/tablet/mobile hero composition: unchanged, already correct (prior
pass). New Arrivals grid structure: unchanged, already correct; its image
`sizes` hint: fixed this session (§4). Video section: unchanged layout,
gained a crop safety net for a future differently-shaped clip (§5). Footer
technology accent: verified already restrained and functional at both
checked breakpoints. Nothing in this session's changes altered any
`.module.scss` layout rule for Hero, FeaturedProducts, or the footer —
only `BrandStory/index.module.scss` gained one property
(`object-fit: cover`).

## 10. What still needs real client input

- **The Laptops & Computers product photo** — unchanged gap, needs a real
  photoshoot or a generated asset per `docs/image-generation-prompts.md`,
  not fixable from source.
- **Whichever hero photo, video clip, and CTA copy Terro wants live** —
  the admin can now set all of it without a deploy; nothing here invents
  business content on the client's behalf (no prices, warranties, delivery
  promises, or claims were added anywhere).
- **A decision on `/styleguide`** — leave it as an internal dev route, add
  a `noindex`, or remove it before a public launch. Still not fixed here,
  same as the prior pass — it's a functional change outside a
  content/admin-integration pass's scope.
- **A real MP4/WebM dimension reader**, if a differently-shaped video is
  likely (§5) — `object-fit: cover` covers the risk for now but a
  correctly-fitted box would look better than a cropped one.

## 11. Limitations

- **No `public/` folder in this upload**, same constraint as the prior
  pass. Nothing here depended on inspecting a real image or video's actual
  pixels — the admin-management work is content-agnostic by construction
  (it stores and resolves *references*, not asset content), and the one
  place resolution genuinely matters (an AVIF hero photo with unknown
  dimensions, §3) degrades to the existing default rather than guessing.
- **No browser available in this session** to screenshot the seven
  requested breakpoints. The New Arrivals `sizes` fix (§4) was verified by
  reading each grid's actual CSS breakpoints and computing the real
  rendered percentage by hand, not by rendering it — flagged as the honest
  gap between "verified against the CSS" and "seen rendered," same
  distinction the prior pass drew for the hero.
- **No live MongoDB in this sandbox**, so verification stopped at
  `tsc`/`eslint`/`vitest` (503 passed, including 22 new tests covering the
  new validation rules and the new global's resolution path) — the same
  bar the prior elite pass used. A full `next build`/`next start` against
  a real database, and one look at `/admin/globals` → "Home page" in a
  browser, are the two checks this session could not perform and would
  recommend doing once before this ships.
