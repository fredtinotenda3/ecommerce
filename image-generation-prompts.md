# Terro Technology — image generation prompts for genuinely missing imagery

This file exists for exactly one gap: **the Laptops & Computers category has
no product photography**, because none of the 24 images Terro supplied
contains a clean, unwatermarked photo of a whole, sellable laptop (see
`docs/image-polish-prompts.md` for the full asset log — the closest
candidates were repair-context photos, a watermarked lifestyle shot, or
marketing collages, none of which is a real product photo). The category
page and its description exist and explain the gap honestly to a visitor
("Photographed listings are on their way"); no product was invented to
paper over it.

Every prompt below is for an **external** AI image tool or a designer —
nothing in this project generates images itself, and none of these prompts
have been run. Treat their output as placeholder e-commerce photography
only: swap it for a real photo of the actual unit Terro is selling before
that listing goes live with a real price, the same way every other product
in this catalogue uses a photo of the actual model. A generated image
implies a specific device to a paying customer; shipping one as a
permanent listing photo is a worse version of the problem this document is
trying to solve, not a fix for it.

## Why no price is given alongside these prompts

Unlike the smartphones, Terro supplied no laptop price list at all (the
existing catalogue's phone prices are transcribed from `boxed-iphones.jpeg`
and `brand-new-samsung.jpeg`; nothing supplied does the same for laptops).
Suggested market positioning is given for realism, but every number below
is this project's estimate of a plausible Zimbabwe retail band, not a
transcribed fact — confirm real pricing with Terro before any of these
become real product listings, exactly as already flagged for the estimated
prices already in `scripts/seed/catalogue.ts`.

## Suggested starter listings and their prompts

Three listings would give the category a realistic, non-overlapping spread
(entry Windows laptop, business ultrabook, preloved MacBook) — matching the
segments a Zimbabwe consumer-tech shop actually stocks, and matching what
Terro's own repair work already implies they handle (MacBook logic-board
and screen repairs are documented in the supplied flyers, so a preloved
MacBook listing is a natural fit alongside that service).

1. **Entry Windows laptop** (suggested band: $280–$420)
   > Studio product photograph of a modern 14-inch Windows laptop, silver or space-grey aluminium-style finish, shown at a three-quarter angle, lid open, screen showing a generic neutral desktop wallpaper (no visible brand logo on the lid or screen). Clean white background, soft even studio lighting, no props, no text overlay, no watermark. High resolution, sharp focus on the keyboard and screen bezel.

2. **Business ultrabook** (suggested band: $500–$750)
   > Studio product photograph of a slim 13-inch business ultrabook in dark grey or black, closed lid shown first at a three-quarter angle with a plain unbranded logo area, second image of it open showing a backlit keyboard. Clean white background, soft even studio lighting, no props, no text overlay, no watermark. High resolution, sharp focus.

3. **Preloved MacBook** (suggested band: $450–$650, priced below equivalent new stock the way the existing preloved iPhone X listing is)
   > Studio product photograph of a used silver MacBook-style laptop (13-inch, unibody aluminium), lid closed, shown at a three-quarter angle under soft studio lighting on a plain white background. The finish should look gently used but well cared for — a faint, realistic scuff or two, not pristine and not heavily worn. No text overlay, no watermark, no visible screen content.

## What this document deliberately does not include

No prompt here asks for a photo of "the Terro Technology shop," "the Terro
team," or anything else presented as if it depicts the real business — an
AI-generated image standing in for an actual storefront or staff photo
would misrepresent the real business, which is a different and worse
problem than a placeholder product photo. The `about` page ships instead
with real supplied photography of repair work (see
`docs/image-polish-prompts.md`) and no invented premises or team image; if
Terro wants a real storefront or team photo on that page, the fix is an
actual photograph, not a generated one.
