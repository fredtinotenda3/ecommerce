# PHASE 13N IMPLEMENTATION REPORT

## Media View-Model Changes

**No new type was added.** Before writing anything, I inspected `src/app/_types/
storefront.ts` for an existing media view model matching this phase's spec
(`url?`/`width?`/`height?`/`alt?`/`filename?`/`mimeType?`, no `.sizes`) and found one
already there: `StorefrontMediaItem`, added in **Phase 13H**, field-for-field identical to
what this phase asked for. Duplicating it under a new name would just fork the same shape
in two places, so I extended its existing doc comment instead (no shape change) with this
phase's audit findings, and reused it directly.

**Audit of the `Media` display component** (task 1), traced line-by-line:

- `src/app/_components/Media/index.tsx` reads exactly one field off `resource`:
  `resource?.mimeType` (to decide the image-vs-video branch).
- `src/app/_components/Media/Image/index.tsx` reads exactly four fields:
  `width`, `height`, `filename`, `alt`. It never reads `.url` — it builds its own URL as
  `` `${NEXT_PUBLIC_SERVER_URL}/media/${filename}` `` and only falls back to a `src` prop
  passed in separately (for static images) if present. The `sizes` attribute passed to
  Next's `<Image>` is computed from `cssVariables.breakpoints` (viewport breakpoints), not
  from anything on `resource` — there is no `resource.sizes` read anywhere.
- `src/app/_components/Media/Video/index.tsx` reads exactly one field: `filename` (same
  URL-building pattern as `Image`).
- **`payload-types.ts`'s generated `Media` interface has no `.sizes` field at all**
  (confirmed via direct inspection — its fields are `id, alt, caption, updatedAt,
  createdAt, url, filename, mimeType, filesize, width, height`). The "needs
  `Media.sizes` for responsive image variants" reasoning recorded in Phase 13H/13L/13M's
  comments describes a caution about a shape that doesn't exist in this codebase's
  generated types — not a field the component actually reads.

Put together: the entire `Media`/`Image`/`Video` rendering path only ever reads `mimeType`,
`width`, `height`, `filename`, `alt` — a strict subset of `StorefrontMediaItem`'s six
fields (it doesn't even use `.url`). This means `Media/types.ts`'s `Props.resource`
(`string | payload-types.ts Media`) *could* be narrowed to `string | StorefrontMediaItem`
without changing anything about what gets rendered. This phase's task list explicitly
scopes that decision out ("If a component passes `media` to `<Media resource={media} />`,
do NOT narrow it yet") — see "Remaining Blockers" / "Recommended Next Phase" for why that's
left as its own follow-up rather than folded into this one.

## Files Migrated Off payload-types.ts

**None.** Every remaining file that imports `payload-types.ts`'s `Media` type
(`HighImpactHero`, `MediumImpactHero`, `Card`, `MediaBlock`, the two order-detail pages,
`ProductHero`) passes its media value directly into `<Media resource={...} />` — none of
them read `media.url`/`media.filename`/`media.alt` themselves and stop there, and none pass
media to an *already-narrowed* component instead of `<Media/>` itself. Per this phase's
explicit instruction (task 4), components in that position are not narrowed this phase,
so the count of files with a `payload-types.ts` import did not change.

## Files Intentionally Left Unchanged

- `src/app/_heros/HighImpact/index.tsx`, `src/app/_heros/MediumImpact/index.tsx` — `media`
  passed straight to `<Media resource={media} priority />` / `<Media resource={media} />`.
- `src/app/_components/Card/index.tsx`, `src/app/_heros/Product/index.tsx` — `metaImage`
  passed straight to `<Media imgClassName={...} resource={metaImage} fill />`.
- `src/app/_blocks/MediaBlock/index.tsx` — `media` passed straight to `<Media resource=
  {media} src={staticImage} />` (both the fullscreen and default branches).
- `src/app/(pages)/orders/[id]/page.tsx`, `src/app/(pages)/account/orders/[id]/page.tsx` —
  `metaImage` passed straight to `<Media className={...} imgClassName={...}
  resource={metaImage} fill />`.
- `src/app/_components/Media/types.ts` — inspected (task 1) but not modified. Its
  `Props.resource` type still reads `string | MediaType` (full `payload-types.ts` `Media`);
  narrowing it is the change this phase's audit sets up but does not make (see above).
- All other files from Phase 13M's "Files Intentionally Left Unchanged" list remain
  unchanged for the same reasons already documented there (CMS layout/hero unions, Cart
  provider/reducer coupling, fetch/auth compatibility boundaries, adapter return shapes
  that mirror Payload) — none of those reasons are specific to Media and none were revisited
  by this phase's Media-only scope.

## Files Created

- `tests/storefrontMediaItem.test.ts` — 3 tests (see manifest for details), including a
  type-level check that the fields `Media`/`Image`/`Video` actually read are a subset of
  `StorefrontMediaItem`.

## Files Modified

- `src/app/_types/storefront.ts` — `StorefrontMediaItem`'s doc comment extended with this
  phase's audit findings. No field added, removed, or renamed; no other export touched.

## Files Deleted

(none)

## New Dependencies

(none)

## Existing Payload Status

Unchanged. Payload remains the default (flag-off) data source. `payload-types.ts` itself
was not touched. `Media/types.ts`'s `Props.resource` type was not touched, so `<Media/>`'s
required prop shape, and therefore every existing call site's compile-time contract with
it, is byte-for-byte unchanged. No rendering logic in `Media/index.tsx`, `Image/index.tsx`,
or `Video/index.tsx` was modified.

## Existing Stripe Status

Unchanged. Not touched by this phase; no Stripe-related file was in scope.

## Remaining payload-types Import Count

Using the same methodology as prior phases'
(`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13N: 41**
- **After Phase 13N: 41**

No change — this phase's deliverable is the audit and view-model groundwork (task 3),
not a file migration, per its own scoping in task 4.

## Remaining Blockers

- The one real blocker to closing the `Media` boundary is `Media/types.ts`'s
  `Props.resource: string | MediaType` — this phase's audit shows narrowing it to
  `string | StorefrontMediaItem` would not change rendering (every field the component
  reads is already covered), but doing so is a single coordinated change that touches a
  shared component plus, in the same breaking-change window, all six call sites
  (`HighImpactHero`, `MediumImpactHero`, `Card`, `MediaBlock`, both order-detail pages,
  `ProductHero`) — safer as its own explicitly-scoped, fully-tested phase than mixed into
  this audit.
- `Card` and `ProductHero`'s `Price`/`AddToCartButton` usage (Cart coupling) and
  `MediaBlock`/order-detail pages' CMS-layout/`Order.items` coupling are separate, already-
  documented blockers (Phase 13M) that would still apply to those files even after `Media`
  is narrowed — narrowing `media` alone would not let those particular files drop their
  `payload-types.ts` import entirely, only swap which type they import for the media field.
  `HighImpactHero`/`MediumImpactHero` are the exception: their `richText`/`links` are
  already narrowed (Phase 13L), so narrowing `media` too would let them drop
  `payload-types.ts` entirely.
- The pre-existing, unrelated `tsc --noEmit` error in `src/app/_blocks/ArchiveBlock/index.tsx`
  (a `sort` prop not present on that block's `Props` type) remains, confirmed present before
  this phase's changes.

## Recommended Next Phase

- Widen `src/app/_components/Media/types.ts`'s `Props.resource` from `string | MediaType`
  to `string | StorefrontMediaItem`, backed by this phase's field-usage audit and its new
  `tests/storefrontMediaItem.test.ts` "rendered fields ⊆ StorefrontMediaItem" check. Then,
  in the same phase, narrow the six call sites' own prop types the same audit identified:
  - `HighImpactHero`/`MediumImpactHero` — drop `payload-types.ts` entirely (their
    `richText`/`links` are already narrowed; only `media` was blocking them).
  - `Card`, `ProductHero`, `MediaBlock`, and the two order-detail pages — narrow just the
    media field; each still keeps its `payload-types.ts` import for other reasons already
    documented in Phase 13M (Cart coupling, CMS layout unions, `Order.items`/`Product`
    relations), so this closes the Media boundary specifically without claiming a bigger
    win than it is.
- That phase should re-run the full `vitest`/`tsc` verification this phase used, plus add
  a regression test asserting `Media/types.ts`'s `Props` type still accepts every current
  real caller's actual value unchanged (mirroring how this phase's tests lock in
  `StorefrontMediaItem` itself).
