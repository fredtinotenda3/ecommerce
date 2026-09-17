# What's in this zip

This archive contains **only the files that changed** from your original
`ecommerce-main` project — 43 files, added or modified, preserving their
original directory paths. Extract it over your existing project and let it
overwrite the matching files.

## Two files must be deleted manually

A zip can only add/overwrite files, it can't delete anything from your
existing checkout. These two files are dead code now and should be removed
after you extract the archive:

1. `src/app/constants/brand.ts` — every hardcoded brand fact that used to
   live here (site name, contact details, social links, navigation, trust
   badges) is now a database-backed field edited at `/admin/globals`. Every
   real import of this file was migrated; only comments elsewhere still
   mention it for historical context.
2. `src/app/_components/Header/Nav/` (the whole folder, `index.tsx` and
   `index.module.scss`) — this was a secondary "supplementary CMS nav"
   renderer that existed alongside the old hardcoded `PRIMARY_NAV`. Now that
   there is only one, fully admin-driven navigation list, this component is
   unused.

If you'd rather not delete them, they are simply inert — nothing imports
them any more, so leaving them in place will not break the build (though
your linter/typechecker won't complain either way since they're not
referenced).

## One new file goes in your media directory, not `src/`

`media/brand-tech-circuit-background-a97f4fe0f6b6.webp` is the new
high-tech blue background artwork (see the admin guide for where it's
used). It belongs in your **media storage directory** — the same place
your other uploaded media files live (`media/` at the repo root by default,
or wherever `MEDIA_DIR` points), **not** under `public/`. This zip's
internal path already reflects that (`media/...`, not `public/media/...`),
so extracting it in place puts the file where the app expects it.

## After extracting

1. Delete the two files listed above.
2. Run `npm install` (no new dependencies were added, but it's good
   practice after a bulk file change).
3. Run `npm run seed:store` against a **fresh/empty** database, or
   `SEED_OVERWRITE=true npm run seed:store` against an existing one, to
   populate Settings/Header/Footer with real starting content (site name,
   contact details, social links, trust badges, navigation, and the new
   background image) instead of leaving the admin screens blank. See
   `ADMIN_GUIDE.md` for what to check afterward.
4. Run `npm run typecheck` and `npm test` — both are verified clean against
   this change set (see the summary below).

## Summary of what changed and why

**The core ask — nothing hardcoded, everything admin-driven:**

- Site identity (name, tagline, description), every contact detail (email,
  two phone numbers, WhatsApp, both shop addresses, hours), social links,
  the four "why buy here" trust badges, and testimonials all moved from a
  hardcoded `constants/brand.ts` into the `Settings` global, editable at
  `/admin/globals`.
- Primary navigation (header) and the three footer link columns moved from
  a hardcoded `PRIMARY_NAV`/`FOOTER_LINK_GROUPS` array into the
  `Header`/`Footer` globals, same place.
- The one hardcoded decorative artwork reference (a bespoke SVG file) was
  replaced by an ordinary admin-uploaded image field —
  `Settings.brandBackgroundImage` — selected from the Media library like
  any other upload, with a plain CSS-gradient fallback everywhere it's used
  so an unconfigured install still renders a coherent design.
- A brand-new install with a completely empty database still renders a
  working site: every field above falls back independently to a
  last-resort default in `src/lib/domain/siteDefaults.ts` (the same
  historically-accurate Terro Technology content that used to be
  hardcoded), and navigation falls back one step further to a single
  generic "Shop" link if even the header global is empty. Nothing in the
  fallback chain requires the seed script to have run.

**The new background image:**

- Generated to your spec: deep navy/electric-blue/cobalt/cyan, a diagonal
  panel, blurred circuit-board interface layers, glowing binary 0s and 1s
  (some sharp, some soft), luminous circuit traces ending in glowing nodes,
  a broad semi-transparent diagonal band through the middle, subtle bloom,
  shallow depth of field.
- Wired in as `Settings.brandBackgroundImage`, resolved once per request
  and threaded to every place it visually fits: a very low-opacity
  sitewide backdrop behind every page (`BrandBackdrop`), the homepage
  hero's two circuitry layers, and the footer's decorative band. It's also
  the fallback Open Graph / social-share image site-wide once configured.
  See `ADMIN_GUIDE.md` for exactly where and how to change it.

**Correctness fixes made along the way** (surfaced while doing this work,
not separately requested, but worth knowing about):

- `scripts/seed/seedStore.ts` validated seeded media against `public/media/`,
  but this app actually serves uploads from `media/` at the repo root
  (`MEDIA_DIR`). That mismatch meant `npm run seed:store` would have failed
  its own validation step on a fresh checkout. Fixed to check the real
  directory.
- The root layout's `generateMetadata` and page body both need Settings on
  every request. The first draft of this used React's `cache()` to dedupe
  the two reads — but this project is pinned to React 18.2 (installs
  18.3.x), which does not export `cache` from `react` at all (it's a
  React-19-era API). That would have typechecked as written but thrown
  `cache is not a function` at runtime. Fixed by reading Settings twice
  instead, the same trade-off `(pages)/products/[slug]/page.tsx` already
  makes on purpose.
- A handful of existing unit tests (`FakeGlobalsRepository`,
  `adminContentService.test.ts`, `fetchGlobals.test.ts`,
  `globalsStorefrontAdapter.test.ts`, `generateMeta.test.ts`) needed
  updating for the new required fields and the new `mediaRepository`
  dependency `saveSettings`/`buildStorefrontSettings` now take. All 509
  tests pass; `tsc --noEmit` and `eslint src` are both clean.

Everything else follows this project's existing conventions exactly: the
repository/service/adapter layering, the "null is not an error, every field
falls back independently" pattern, and the admin form validation style
already used for the `Home` global.
