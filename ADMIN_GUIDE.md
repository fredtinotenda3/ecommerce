# Terro Technology — Admin Guide - Dynamic

This guide covers the admin panel as it stands after this change set: every
piece of site content that previously lived in source code — the site
name, contact details, social links, trust badges, navigation, and the
decorative background image — is now edited here, in the database, with no
redeploy required.

It's organized so you can either read it end to end once, or jump straight
to the section you need later.

1. [Signing in](#1-signing-in)
2. [The admin layout, at a glance](#2-the-admin-layout-at-a-glance)
3. [Media — upload before you configure](#3-media--upload-before-you-configure)
4. [Globals: Header (site navigation)](#4-globals-header-site-navigation)
5. [Globals: Footer](#5-globals-footer)
6. [Globals: Settings — the site's identity](#6-globals-settings--the-sites-identity)
7. [Globals: Home page](#7-globals-home-page)
8. [The brand background image, specifically](#8-the-brand-background-image-specifically)
9. [Products, Categories, Pages, Orders, Customers, Redirects](#9-products-categories-pages-orders-customers-redirects)
10. [What still has a built-in default, and why](#10-what-still-has-a-built-in-default-and-why)
11. [Common tasks, step by step](#11-common-tasks-step-by-step)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Signing in

There is no separate admin login page — the admin area uses the same
sign-in as a customer account, at `/login`. What gets you into `/admin` is
your **account role**, not a different URL or password scheme.

The very first admin account can't be created by signing up on the site
(self-registration always creates a plain customer account). It's created
once, from the server, with:

```
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run seed:admin
```

This either creates a new account with that email and the `admin` role, or
— if an account with that email already exists — promotes it to admin
without touching its existing password (add `ADMIN_RESET_PASSWORD=true` if
you also want to reset the password at the same time).

Once you have one admin account, sign in at `/login` with those
credentials and you'll see an "Admin" badge and a link into `/admin` in
your account area. **Every further admin is promoted from inside the admin
area itself** — go to `Customers`, open the person's account, and change
their role there. You never need to run the seed script again after the
first account.

If you visit `/admin` without an admin session, you get an ordinary 404 —
not a login prompt, not a 403. This is deliberate: a stranger probing the
site learns nothing about whether an admin area even exists.

## 2. The admin layout, at a glance

Every admin page shares one layout: a top bar (your site name, your email,
a "View store" link back to the public site) and a row of section tabs
underneath it:

| Section | What it's for |
|---|---|
| Products | Create/edit products, prices, publish or unpublish, bulk actions |
| Categories | The category tree behind product filters and homepage tiles |
| Orders | Fulfilment status per order, with valid status transitions enforced |
| Customers | Accounts, their orders, and role promotion (this is how you make more admins) |
| Pages | CMS content pages — hero and body content, SEO metadata |
| Media | Upload images/video, fix alt text, delete unused files |
| **Globals** | **Header/footer navigation and Settings — this is the section this guide focuses on** |
| Redirects | Path redirects applied to incoming requests |

This guide focuses on **Globals**, since that's where everything newly
admin-driven lives, plus the parts of **Media** you need alongside it. The
other sections (Products, Categories, Orders, Customers, Pages, Redirects)
were already admin-managed before this change and are not affected by it.

## 3. Media — upload before you configure

Several Settings and Home fields below are "pick an image" dropdowns
rather than "paste a URL" fields — on purpose, so a broken or mistyped URL
can't be saved. **Upload the file first, on the Media screen, then come
back and select it.**

On `/admin/media`:

1. Choose a file. Accepted types: JPEG, PNG, GIF, WebP, AVIF, MP4, WebM.
2. Optionally type alt text before uploading (you can also add or fix it
   afterward by opening the file from the table).
3. Click upload. The file is stored on the server (not in a third-party
   bucket) and immediately available to pick from any "select an image"
   field elsewhere in the admin.

Every image should have alt text — the media list tells you up front how
many files are missing it. Deleting a file here removes it from disk as
well as from the library, so double-check nothing still references it
first (if something does, the site falls back gracefully rather than
breaking, per the "null is not an error" design throughout this app — but
an orphaned reference is still worth fixing).

## 4. Globals: Header (site navigation)

`/admin/globals` → **Header** section.

This one field, **Nav items**, is a JSON array — the exact list of links
shown in the site's top navigation and mobile menu. Each entry is one of:

```json
{ "type": "reference", "label": "Shop all", "referencePageId": "<a page's id>" }
```
— links to a page you manage on the Pages screen; if that page is ever
renamed or deleted, this link updates or is safely dropped rather than
breaking — or:

```json
{ "type": "custom", "label": "Instagram", "url": "https://instagram.com/yourshop" }
```
— any URL, internal path or external link.

Both forms accept two optional properties: `"newTab": true` (opens in a
new tab) and `"iconMediaId": "<a media id>"` (a small icon next to the
label — upload it on the Media screen first).

**Example — the navigation this app ships with by default**, if you want
a starting point to edit rather than starting from `[]`:

```json
[
  { "type": "custom", "label": "Shop all", "url": "/products" },
  { "type": "custom", "label": "Smartphones", "url": "/products?category=smartphones" },
  { "type": "custom", "label": "Laptops & computers", "url": "/products?category=laptops-computers" },
  { "type": "custom", "label": "Gaming", "url": "/products?category=gaming" },
  { "type": "custom", "label": "Accessories", "url": "/products?category=accessories-parts" }
]
```

If you leave this completely empty (`[]`) and haven't run the seed script,
the site does not disappear — it falls back to a single generic "Shop"
link pointing at `/products`, so the header is never nav-less. That's a
last-resort safety net, not a substitute for setting up real navigation.

The category `?category=` links above only work if your category titles
derive to those exact slugs (the slug is generated automatically from the
title — lowercase, spaces and punctuation collapsed to hyphens). Check a
category's actual slug on the Categories screen if a nav link isn't
filtering correctly.

## 5. Globals: Footer

`/admin/globals` → **Footer** section. Three fields:

**Copyright line** — plain text, e.g. `© 2026 Terro Technology. All rights
reserved.` Shown at the very bottom of every page.

**Footer link columns** — a JSON array of grouped links, the "Shop /
Your account / Help" style columns above the copyright line:

```json
[
  {
    "title": "Shop",
    "links": [
      { "label": "All products", "href": "/products" },
      { "label": "Smartphones", "href": "/products?category=smartphones" }
    ]
  },
  {
    "title": "Help",
    "links": [
      { "label": "Contact us", "href": "/contact" }
    ]
  }
]
```
Up to 6 columns, up to 10 links each.

**Social links (icon row)** — same JSON shape as the Header's Nav items
(above), but this specific field controls only the small icon row printed
at the very bottom of the footer, underneath the copyright line. **The
labelled social links shown elsewhere on the site (e.g. any prominent
"Follow us" block) come from Settings → Social links, not this field** —
they're intentionally two different mechanisms serving two different
visual placements, so don't be surprised if editing one doesn't move the
other.

## 6. Globals: Settings — the site's identity

`/admin/globals` → **Settings** section. This is the biggest section and
the one that replaces almost everything that used to be hardcoded.

| Field | What it controls |
|---|---|
| Site name | Header, footer, browser tab title, every shared/social link |
| Tagline | Short line under the site name (e.g. "Sorted properly.") |
| Site description | 1–2 sentences; used for search engines and social share previews |
| **Brand background image** | The decorative circuit-pattern backdrop — see [section 8](#8-the-brand-background-image-specifically) |
| Contact email | Shown on the Contact page and anywhere contact details appear |
| Contact phone (primary) | Same |
| Contact phone (secondary) | Optional second line, e.g. a second shop counter's number |
| WhatsApp number | **Digits only, with country code, no `+` and no spaces** — e.g. `263773818274` — used to build `wa.me/...` links across the site (product pages, the custom-PC quote button, the Contact page) |
| Address (primary counter) | JSON array of short lines, printed one per line, e.g. `["Shop 9, First Floor", "Cnr Main St & 2nd Ave, Harare"]` |
| Address (second counter) | Same shape; leave as `[]` if you only have one location |
| Opening hours line | Plain text, one line |
| Social links | JSON array — see below |
| Trust badges | JSON array — see below |
| Testimonials | JSON array — see below |
| Products page | Which CMS page the cart/checkout's "continue shopping" link sends an empty-cart shopper to |

**Social links** format:
```json
[
  { "platform": "instagram", "url": "https://instagram.com/yourshop" },
  { "platform": "whatsapp", "url": "https://wa.me/263773818274" }
]
```
`platform` must be one of: `instagram`, `facebook`, `whatsapp`, `tiktok`,
`x`, `youtube`, `linkedin`, `other`. Only `other` requires a `"label"` too
(every other platform gets its label from its own icon). Up to 8 entries.

**Trust badges** (the "why buy here" band shown on the homepage and again
on every product page, as a short reassurance list) format:
```json
[
  { "title": "Repairs & accessories", "description": "Screens, batteries, covers…", "icon": "repair" }
]
```
`icon` must be one of: `box`, `repair`, `payment`, `message`. Up to 6
entries. **Only put a claim here that is actually true for your business**
— this app is deliberately built to never invent a policy (a warranty
term, a delivery promise) you haven't confirmed; that discipline is on you
once this becomes admin-editable, since nothing server-side can verify a
business claim is accurate.

**Testimonials** format:
```json
[
  { "quote": "Sorted my phone out same day.", "name": "T. Moyo", "role": "Harare" }
]
```
Up to 12 entries. **Leave this as `[]` until you have real customer
quotes** — the testimonials section on the homepage simply doesn't render
at all when this is empty, which is the correct, honest behaviour. Do not
fill this with invented quotes for a real, named business.

Every field in Settings falls back independently to a sensible built-in
default when left empty (see [section 10](#10-what-still-has-a-built-in-default-and-why)),
so you can fill these in gradually rather than all at once — an unfilled
field never breaks the page, it just shows the generic default for that
one field.

## 7. Globals: Home page

`/admin/globals` → **Home page** section. Controls the homepage hero
banner and the brand-story video band beneath it. The homepage's overall
section order (hero → categories → new arrivals → custom-PC spotlight →
trust badges → video → testimonials) is fixed in code, but the content
inside the hero and video sections is edited here.

Key fields: hero eyebrow/heading/heading-accent/description, up to 3 short
"hero trust points" (a JSON array of strings, e.g. `["Boxed & preloved
stock", "Repairs done in-store"]` — a 4th is rejected because it wraps to
a second line on a phone), two call-to-action buttons (label + link, set
both or neither), a hero product photo (pick from Media), and the same
pattern again for the brand-story video section (eyebrow/heading/
description/link, a video file, and a poster image shown before playback).

Leave any individual field empty to keep that field's built-in default —
you don't need to configure the whole section at once, and a partially
filled-in hero still renders correctly.

## 8. The brand background image, specifically

This is the new high-tech blue circuit-pattern artwork. It's configured in
exactly one place — **Settings → Brand background image** — and from
there it automatically appears everywhere it's designed to fit:

- A very subtle, low-opacity wash behind every page on the site (fixed in
  place, so it doesn't scroll with the content).
- The two decorative circuitry layers behind the homepage hero's product
  photo.
- The decorative band behind the footer's copyright area.
- The fallback image used when a page or product is shared on social media
  and has no image of its own.

**To change it:** upload a new image on the Media screen, then go to
Settings and pick it from the "Brand background image" dropdown, then
save. All four placements above update from that one change — you never
edit them individually.

**To remove it:** set the dropdown back to "— none —" and save. Every
placement degrades to a plain CSS gradient in the same blue palette
instead of disappearing outright, so the site never looks broken while
you're between images.

The image shipped with this change set is
`brand-tech-circuit-background-a97f4fe0f6b6.webp` (2560×1440). If you're
setting this up for the first time, run `npm run seed:store` (see the
`CHANGES-README.md` in this same zip) and it will be uploaded and wired in
for you automatically; otherwise, upload it manually from wherever this
zip placed it in your `media/` directory.

## 9. Products, Categories, Pages, Orders, Customers, Redirects

These sections were already fully admin-driven before this change and
nothing about them changed here — they're listed for completeness:

- **Products** — create/edit, set price (and an optional "compare at"
  price for showing a discount — only use this if there's a real previous
  price), assign categories, publish/unpublish, bulk actions.
- **Categories** — title, description, image; the category tree drives
  both the product filter sidebar and the homepage category tiles. A
  category's `?category=` URL token is auto-derived from its title, not a
  separate field you set.
- **Pages** — general CMS pages (About, FAQ, Delivery & returns, etc.):
  hero type and copy, body content blocks, SEO title/description.
- **Orders** — see every order's items, payment status, and fulfilment
  status; only valid status transitions are allowed (you can't jump
  backwards from "delivered" to "pending", for instance).
- **Customers** — view accounts and their order history, and **this is
  where you promote a customer account to admin** once you need a second
  admin user.
- **Redirects** — old-path → new-path rules applied by the edge middleware,
  for when you rename or remove a page's URL.

## 10. What still has a built-in default, and why

Every field this guide covers falls back to a sensible default when unset,
so a brand-new install (or a field you haven't gotten to yet) never shows
a blank or broken page. Those defaults live in one file,
`src/lib/domain/siteDefaults.ts`, and are the same real Terro Technology
content (transcribed from the client's own supplied flyers) that used to
be hardcoded — nothing invented. Once you save a value in the admin, your
value takes over from the default for that field, permanently, until you
clear it again.

Two fields are the deliberate exception to "falls back to a default":

- **Testimonials** defaults to *empty*, not to a set of example quotes —
  because inventing customer testimonials for a real business is exactly
  the kind of fabrication this app is built to avoid. An empty list means
  "no testimonials section," which is the honest state until you have real
  ones to add.
- **Trust badges** and every contact/address field similarly default to
  only what's actually documented from the client's own materials — never
  a plausible-sounding but unconfirmed claim (a delivery promise, a
  warranty term) that nobody signed off on.

The **navigation** fallback is a separate, narrower safety net: if the
Header global is completely empty (a fresh install before the first seed
or the first admin edit), the site shows a single generic "Shop" link
rather than no navigation at all — deliberately generic, since baking in
any specific business's categories as a code-level fallback would be the
same category of hardcoding this whole change set removes.

## 11. Common tasks, step by step

**Change the site name everywhere at once**
→ Settings → Site name → Save. Updates the header, footer, browser tab,
and every social-share preview.

**Add a new social media link**
→ Settings → Social links → add an entry to the JSON array → Save.

**Swap the homepage hero photo**
→ Media → upload the new photo (with alt text) → Home page → Hero product
photo → select it → Save.

**Add a testimonial**
→ Settings → Testimonials → add `{ "quote": "...", "name": "...", "role": "..." }`
to the array → Save. The homepage testimonials section will start
rendering as soon as there's at least one entry.

**Promote a second admin**
→ Customers → open their account → change role to include `admin` → Save.

**Change the background artwork**
→ see [section 8](#8-the-brand-background-image-specifically) above.

**Add a page to the main navigation**
→ Pages → note the id of the page you want to link to (shown on that
page's edit screen, and referenced from the note at the bottom of the
Globals screen) → Globals → Header → add
`{ "type": "reference", "label": "...", "referencePageId": "<that id>" }`
to Nav items → Save.

## 12. Troubleshooting

**"I saved a JSON field and it didn't take effect / the form showed an error"**
Every JSON field is validated on save — a malformed entry (wrong platform
name, a missing required property, too many items) is rejected with a
message explaining what's wrong, rather than silently saved and breaking
the storefront. Re-check the shape against the examples in this guide and
resubmit; nothing is partially saved.

**"I deleted a page and now a nav link goes nowhere"**
Reference-type nav links resolve to nothing (not a broken link, just
absent) when their target page no longer exists — the header simply won't
render that one entry. Open Globals → Header and remove or repoint the
stale entry.

**"I set a background image but don't see it"**
Every placement uses it at fairly low opacity by design (it's a background
accent, not a hero image) — check the very edge of the homepage hero, or
view the page in dark mode, where it's more visible. If it's genuinely not
showing at all, confirm the image is still present in the Media library
(hasn't been deleted) and that Settings → Brand background image still
shows it selected, not "— none —".

**"The admin area 404s for me"**
This means your account does not have the `admin` role — a 404 here is
deliberate and does not distinguish "no such page" from "you're not
authorized," so double-check with whoever set up your account, or use
`npm run seed:admin` (see section 1) if you're setting this up for the
first time.
