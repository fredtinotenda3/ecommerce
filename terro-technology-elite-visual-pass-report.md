# Terro Technology — elite visual direction pass, implementation report

`terro-technology-elite-pass-changed-files.zip` — 15 changed/new files (154 KB,
dominated by four new SVG assets). No architecture, API, auth, checkout,
payment, tenancy, admin CRUD, catalogue, or business-logic files touched.

**Verified:** `npx tsc --noEmit` clean · `npx eslint src` clean · `npx vitest run`
**481 passed / 46 files**, no regressions · each touched `.module.scss` compiles
clean standalone · the reworked hero was rendered through a structural
Playwright mock (real compiled CSS and markup, a placeholder in place of the
missing real photo — see "Limitations") at 1440/1280/1024/768/430/390/375px
with no overflow, no text/CTA collision, and the product stage staying large
at every width.

---

## Two decisions made before touching code

This session opened with two real conflicts between the brief and the actual
repository, both put to you directly rather than guessed at:

1. **Canonical colours.** The brief's locked values (`#020654`/`#01157D`/
   `#003AEE`/`#0099FE`) turned out to be an *earlier* round's sampling of the
   same reference image — the codebase has been through at least three
   rounds of re-sampling, and the current `brand.scss` values
   (`#010B62`/`#011584`/`#0039EE`/`#009CFE`) are the most recent, most
   rigorously documented pass (pixel-region sampling methodology and WCAG
   contrast figures written into the file). You chose to keep the current
   values. **`brand.scss` was not touched this session.** If this keeps
   coming up across passes, the fix is to stop re-sampling from a photo and
   write the four hex values down once, somewhere both the brief-writer and
   the codebase read from.
2. **Missing assets.** This upload contained no `public/` folder at all — no
   hero photo, no category/product images, no video file, no logo. You chose
   to proceed code-only. Everything below that depends on the *content* of a
   real image or video was built against the facts already on record in
   `docs/image-polish-prompts.md` and `docs/terro-technology-setup.md`
   (exact dimensions, crops, sources), not a fresh look at pixels I don't
   have. See "Limitations" for exactly what that means in practice.

## 1. Hero

**How the product visual was enlarged**: not by upscaling the source. The
real photograph (`/brand/hero-phones.png`) is a genuine 460×280 crop from a
supplied flyer — stretching it much past its own resolution starts to look
soft, and the brief explicitly rules out hiding that with blur. What grew is
the *stage* around it:

- The grid split moved from 55/45 (copy/art) to roughly 36/64 at full desktop
  width, giving the art column the ~60–70% visual weight the brief asks for.
- A blurred, larger "echo" of the same real photograph sits behind the crisp
  one (depth and scale, not a second asset, not a claim of higher
  resolution) — `.artEcho` in `Home/Hero/index.module.scss`.
- A new bespoke technology-panel SVG frames the art stage directly
  (`.stagePanel`), in addition to the existing full-band backdrop
  (`.circuit`), plus a stronger two-tone ambient glow.
- The crisp photograph itself (`.artImage`) keeps a similar real-pixel cap to
  before (≈30rem) — that's the one number this pass deliberately did *not*
  grow, and the code comment says so directly.

**Approximate visual dominance achieved**: the art *stage* (glow + panel +
photo + echo) occupies ~64% of the row width at desktop breakpoints, ~62% at
the 1280–1440 tier. The crisp photograph inside that stage is still a modest
fraction of that area — composition carries the "large and important" read,
not the raw asset.

**Desktop/tablet/mobile composition**: two-column desktop split narrows
slightly at ≤1440 (`large-break`), stacks at ≤1024 (`mid-break`) into a
single column with a deliberately large art-stage cap (32rem, not the old
24rem) rather than a shrunk desktop layout, and steps down again at ≤768 and
≤400. Verified with no horizontal overflow or CTA/text collision at all
seven requested widths (see the report header).

## 2. Technology panel

**Where it was used**: the homepage hero (full-band backdrop `.circuit`,
plus the art stage's own tighter `.stagePanel` accent) and the
`NewsletterBand`'s dark feature section (a small top-right corner accent,
unchanged in role from before — just a richer asset). Four distinct SVG
compositions were generated, not one image reused: `tech-panel-hero-desktop`,
`tech-panel-hero-mobile`, `tech-panel-band-wide` (generated but currently
unused — kept on disk for a future section that wants a wide, low crop) and
`tech-panel-corner`.

**Where it was deliberately NOT used**: the footer, product/category page
headers, and other section transitions were all considered during the
placement audit and left alone — they already read cleanly on typography and
imagery alone, and adding a third or fourth placement would have been
exactly the "circuit graphic everywhere" the brief warns against.

**How it was integrated**: as real SVG image assets (`background-image`),
not a pile of CSS gradients — each one a hand-authored composition (diagonal
navy→cobalt→cyan gradient, Manhattan-style circuit traces with occasional
45° diagonal hops, glowing nodes, subtle binary digits, soft ambient glow
blobs, an edge feather so it blends into the page rather than reading as a
pasted rectangle), built directly from the four canonical `--th-brand-*` hex
values. See "Limitations" for why SVG and not a raster/AI-generated image.

## 3. Homepage video

**Where it was placed**: a new `Home/BrandStory` section, seeded into the
homepage's fixed composition between `ValueProps` ("why us") and
`Testimonials` ("proof") — after making the case for buying here, show the
shop and services in motion, then social proof, then convert.

**How it was presented**: the same real, already-verified Terro Technology
clip (`/media/terro-story.mp4`, poster `/media/terro-story-poster.jpg`) used
a second time, not a new video and not relabelled — same click-to-play
native `<video controls>` treatment as its existing Services-page placement
(no autoplay, not muted, since it carries real narration), same accessible
fallback link. The homepage layout mirrors the Services placement rather
than copying it outright (player column first here instead of second) so
the two don't read as a duplicated block.

## 4. Image polish

`docs/image-polish-prompts.md` (and its root-level copy) now carries a
dedicated "Category polish prompts" section with one tailored prompt per
requested category:

- **Printers & Office Tech** — launch-ready as photography; prompt covers
  lighting/background consistency between the two existing crops.
- **Gaming** — launch-ready; prompt is a colour-grade pass to match the
  site's cool tone (same treatment already recommended for the warranty
  photo), explicitly preserving the RGB lighting as shot.
- **Accessories & Parts** — launch-ready; prompt addresses the flat-lay
  composition (a considered arrangement instead of a "pile") without
  inventing or removing any item.
- **Laptops & Computers** — flagged as the wrong target for a polish prompt:
  the one asset on file is a genuine repair-bench photo, not product
  photography of a sellable laptop, and polishing it wouldn't fix that. The
  real gap is handled in `docs/image-generation-prompts.md`, which already
  covered exactly this category before this session and now states plainly
  why the other three categories don't need generation prompts.

No image files were actually retouched this session — there were none in
this upload to retouch (see "Limitations").

## 5. Template/demo copy

**Audit result**: none of the specific Payload/demo strings listed in the
brief exist anywhere in this codebase (`grep` across `src/app` for each
literal phrase, admin included: zero matches). This is expected, not a
gap I'm glossing over — this project fully migrated off Payload CMS before
this session (see `FINAL_REPORT.md` in the repo), so there's no Payload
admin UI left to carry that boilerplate. A broader sweep for generic
template markers (`Lorem ipsum`, "this is a demo", etc.) found matches only
inside `/styleguide/**`, a component-showcase route with no link from any
nav, footer, or page a customer would reach — reviewed and deliberately left
alone as an internal dev tool, consistent with "if it's outside this
visual/content scope, leave it alone." If you'd rather it not exist in
production, that's a one-line `robots.ts` addition or a route removal — a
functional change, so intentionally not made in this pass.

**Confirmation**: customer-facing framework boilerplate — Admin Dashboard/
Paywall/Page Builder/Dark Mode/Recent-Products-style copy — was already
removed in this project's prior CMS migration and stayed removed. Nothing in
this pass needed to touch it again.

## 6. Assets

**Reused**: the existing real photographs and the Services-page video,
exactly as already established in `docs/image-polish-prompts.md` and
`docs/terro-technology-setup.md` — none were re-derived or replaced, since
none were available to work from this session.

**Created**: four hand-authored SVG technology-panel assets (11–22 KB each,
~70 KB total) — see "Limitations" for why SVG rather than a raster or
AI-generated image.

**Assets that still need real replacement/retouching**: everything named in
`docs/image-polish-prompts.md`'s existing "Polish prompts for an external
design tool" section (the icon vector redraw, the hero-phones professional
cutout, the warranty-bench colour grade) plus the four new category prompts
above — none required before launch, all optional upgrades. The one real
launch-blocking gap, Laptops & Computers product photography, is unchanged
from before this session and is covered by `docs/image-generation-prompts.md`.

## 7. Limitations

- **This upload had no `public/` folder.** No hero photo, no category or
  product images, no video, no logo/favicon files were available to open,
  measure, crop, or retouch. Every claim in this report about an existing
  asset's dimensions, crop, or content is sourced from this project's own
  prior, verified documentation (`docs/image-polish-prompts.md`,
  `docs/terro-technology-setup.md`), not a fresh inspection. The hero's
  visual-dominance work, the technology-panel placements, and the video
  section are all real, working code — but none of it has been seen
  rendered against the real photographs and video, only against a
  structural placeholder. **Before this ships, render the homepage and
  confirm the hero and video sections against the real assets once.**
- **No true raster or AI-generated imagery was produced.** This environment
  has no image-generation tool available, so the "technology panel" artwork
  is a hand-authored SVG rather than the raster asset the brief describes —
  a deliberate, documented substitution (see each SVG's own header comment),
  not a shortcut taken silently. It renders crisply at any size and costs
  under 25 KB per file, but it is vector line/glow art, not a photographic
  "circuit board" texture.
- **The brand-colour discrepancy is worth closing permanently.** Not a bug
  in this pass, but a process gap: three-plus rounds of re-sampling the same
  reference image have produced three-plus slightly different "canonical"
  hex value sets. Recommend picking one, writing it down once outside the
  codebase, and treating every future brief's colour section as a citation
  of that single source rather than a fresh re-sample.
- **`/styleguide` is unlinked but not access-controlled.** Noted in the
  template-copy section above — flagging again here since it's a genuine,
  if minor, launch-readiness item, not something this pass fixed.
