# PHASE 13H IMPLEMENTATION REPORT

## Media View-Model Added

Added `StorefrontMediaItem` to the existing `src/app/_types/storefront.ts`
(no new file — extended the module the way its own header comment asks
future phases to, same as Phase 13G's `StorefrontOrderSummary`/
`StorefrontMetaDoc` additions):

```ts
export interface StorefrontMediaItem {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  filename?: string | null
  mimeType?: string | null
}
```

Field names/optionality were checked directly against `payload-types.ts`'s
`Media` interface (`id`, `alt`, `caption`, `updatedAt`, `createdAt`,
`url?`, `filename?`, `mimeType?`, `filesize?`, `width?`, `height?`) —
every field this type declares exists on the real `Media` shape, so any
real `Media` object (and everything `mediaStorefrontAdapter.ts`'s
`toStorefrontMedia` produces for the native-repository path) satisfies it
unchanged. `filesize`/`caption`/`id`/`createdAt`/`updatedAt` are
deliberately omitted — no candidate file reads them.

This is a distinct, slightly wider type from the existing
`StorefrontMediaRef` (which is just `.url`, for CSS
backgrounds/plain-`src` cases like `CategoryCard`). `StorefrontMediaItem`
is for a component that reads more than one plain scalar field off the
same already-populated media object. Both explicitly exclude `.sizes` —
see "No native `Media.sizes` equivalent" below.

## Files Migrated Off payload-types.ts

**None.** Re-auditing all 51 files that import `payload-types.ts` found
exactly one file with any media-only usage worth narrowing
(`FooterComponent` — see below), and that file also needs `Footer` for
an unrelated reason (`navItems`, a CMS link union — explicitly out of
scope for this phase), so it doesn't drop the import. The 51-file count
is unchanged from the end of Phase 13G.

This is a real finding, not a shortcut: Phases 13D–13G already migrated
every file whose *entire* `payload-types.ts` usage was narrowable. What
remains splits cleanly into four categories established in prior phases
(Media/responsive-image consumers, CMS layout/hero unions, Cart
provider/reducer coupling, and the native-repository compatibility
boundary) — see "Files Intentionally Left Unchanged" for the full
per-file breakdown re-verified this phase.

## Files Narrowed (partial — import retained for an unrelated reason)

| File | Dropped | Kept, and why |
|---|---|---|
| `Footer/FooterComponent/index.tsx` | `Media` (only `.url` was ever read, cast from a link's `icon` field, passed straight to `next/image`'s `src`) | `Footer` — `navItems` is the same CMS link union `Header`/`CallToAction`/`Content` consume; out of scope this phase |

The cast from `item?.link?.icon` (typed `string | Media` on `Footer`)
to the new narrower `StorefrontMediaItem` needed to go through
`as unknown as` rather than a direct `as` — `StorefrontMediaItem` and
`Media` don't "sufficiently overlap" in TypeScript's structural sense in
the direction needed for a bare assertion (missing `Media`'s required
`id`/`alt`/`createdAt`/`updatedAt`), and a bare `as StorefrontMediaItem`
would have been a new `tsc` error. This is the same double-cast pattern
already used throughout `src/lib/repositories/*.ts` (e.g.
`doc as unknown as UserDocument`), so it's consistent with the existing
codebase convention, not a new one.

## CMS Layout/Hero Planning Document Created

`docs/native-cms-layout-plan.md` — covers:

- The exact current `Page['layout']`/`Page['hero']` shapes (all four
  block kinds, the shared link/reference union, `Product['layout']`
  reusing the same shapes verbatim)
- Every consuming file: the `Blocks`/`Hero` dispatchers, all four block
  components + `ArchiveBlock/types.ts`, all four `Page['hero']`-typed
  hero variants (plus `ProductHero`, which doesn't consume it, included
  for completeness), every page route that passes `layout`/`hero`
  through, the shared link union's consumers (`Header`/`Footer`
  nav globals, `CMSLink`), and the native-side mirror that already
  exists but is deliberately untyped (`domain/types.ts`'s
  `layout: unknown[]` / `hero: unknown`, and the unchecked `as
  PayloadPage['layout']` casts already present in
  `pageStorefrontAdapter.ts`)
- What a native equivalent needs: a discriminated union type, a native
  hero type, a shared link/reference type, real validation at the
  repository boundary (replacing the current untyped `RawBlock` walk in
  `layoutRelationsAdapter.ts`), and a mapping layer back to
  `payload-types.ts`'s shape so the render layer can migrate
  incrementally
- Coordinated-change file list, split into "must land together" vs.
  "can stay on the Payload-shaped union indefinitely"
- Risks: silent shape drift surfacing pre-existing data issues once real
  validation replaces the current unchecked casts, an ongoing
  hand-mirroring maintenance cost (no codegen for the native side the
  way Payload has), `archive` as the highest-risk block, the link union
  as the widest-blast-radius piece, a literal-discriminant requirement
  for the `Blocks`/`Hero` dispatchers' narrowing to keep working, and an
  explicit note that this work is independent of (and doesn't reuse)
  this phase's `StorefrontMediaItem` — `hero.media`/`mediaBlock.media`
  still need the *full* native `Media` shape since they render through
  the `Media` display component
- An 8-step suggested sequencing (types → repository validation → link
  union → `mediaBlock` → `cta`/`content` → `hero` → `archive` last →
  optional dispatcher/adapter cleanup), each sized as its own future
  phase
- Rough relative scope per step, with `archive` and the repository
  validation step flagged as the highest-uncertainty work

No code in the CMS layout/hero area was changed — this task was planning
only, per the phase objective.

## Files Created

- `docs/native-cms-layout-plan.md`
- `PHASE13H_REPORT.md` (this file)
- `PHASE13H_MANIFEST.md`

## Files Modified

- `src/app/_types/storefront.ts` — added `StorefrontMediaItem`
- `src/app/_components/Footer/FooterComponent/index.tsx` — narrowed the
  `Media` cast to `StorefrontMediaItem`

## Files Deleted

None.

## Files Intentionally Left Unchanged

Re-traced all 51 files' actual field reads this phase (not just their
declared prop types). Every one still needs the full `payload-types.ts`
shape it currently imports, for one of these reasons:

- **`Media`/responsive-image consumers** (pass a full media object to
  the `Media` display component, or are the `Media` component's own type
  definition): `Card`, `CollectionArchive`, `RelatedProducts`,
  `MediaBlock`, all four hero variants (`CustomHero`, `HighImpact`,
  `LowImpact`, `MediumImpact`), `Media/types.ts` itself, the
  order-*detail* pages (`orders/[id]/page.tsx`,
  `account/orders/[id]/page.tsx`), `products/[slug]/page.tsx` (passes
  the full `Product` into `ProductHero` and into `Blocks`'s `docs`),
  `_heros/Product/index.tsx`.
- **CMS layout/hero discriminated unions**: `ArchiveBlock/types.ts`,
  `CallToAction`, `Content`, `Header`/`HeaderComponent`/`Header/Nav`
  (`navItems`), `Footer/index.tsx` (wraps `FooterComponent`, typed on
  `Footer`), `PaywallBlocks`, `Hero/index.tsx` (typed directly as
  `Page['hero']`), `[slug]/page.tsx`, `cart/page.tsx`,
  `products/page.tsx` (all three pass `page.layout`/`page.hero`
  through).
- **Cart provider/reducer coupling**: `AddToCartButton`,
  `RemoveFromCartButton`, `Cart/index.tsx`, `Cart/reducer.ts`,
  `CheckoutForm` (order-creation payload is built from Cart's own
  `CartItem` shape) — all explicitly out of scope per this phase's
  "Do NOT modify Cart provider/reducer" instruction.
- **Compatibility-boundary by design** (unchanged since Phase 13F-B):
  all 8 `*StorefrontAdapter.ts` files (`categoryStorefrontAdapter`,
  `globalsStorefrontAdapter`, `layoutRelationsAdapter`,
  `mediaStorefrontAdapter`, `minimalProductAdapter`,
  `pageStorefrontAdapter`, `productStorefrontAdapter`,
  `userStorefrontAdapter`), the native fetch
  helpers/`fetchDoc`/`fetchDocs`/`getMe` (`fetchCategoriesNative`,
  `fetchDoc`, `fetchDocs`, `fetchGlobals`, `fetchGlobalsNative`,
  `fetchPageNative`, `fetchProductNative`, `getMe`, `meNative`), and the
  Auth provider (`Auth/index.tsx`, `nativeAuthUser.ts`, `getMeUser.ts`).

`Footer/FooterComponent/index.tsx` is the one file with mixed usage this
phase found and acted on (see "Files Narrowed" above) — every other file
in the 51 was single-reason and confirmed to still need what it imports.

## Validation Results

**Not run.** This environment has no network access (`npm install`
fails with `403 Forbidden` against the npm registry) and no
pre-installed `node_modules` for this project, and I could not locate a
cached copy to restore from. I was not able to execute `npm run lint`,
`npx tsc --noEmit`, or `npm run test` against these changes.

What I did instead, in place of running the compiler:

- Manually verified `StorefrontMediaItem`'s fields and optionality
  against `payload-types.ts`'s real `Media` interface, field-by-field.
- Manually traced the assignability of the `FooterComponent` cast and
  caught that a direct `as StorefrontMediaItem` would fail TypeScript's
  "sufficiently overlaps" check (source type `string | Media`, and
  neither `StorefrontMediaItem` nor `Media` is assignable to the other
  in the required direction) — fixed by going through `as unknown as`,
  matching the codebase's existing double-cast convention.
- Confirmed `strict: false` in `tsconfig.json`, so the new `| null` on
  `StorefrontMediaItem`'s fields (vs. the real `Media`'s `| undefined`)
  doesn't introduce a `next/image` `src` type mismatch.
- Re-ran the same file-search methodology Phase 13G used
  (`grep -rlE "from ['\"].*payload-types['\"]"`) to confirm the 51-file
  count is unchanged and to re-verify no file's import list changed
  except `FooterComponent`'s.

**Please run these three commands yourself before relying on this
phase's output**, the same way every prior phase's report states a real
lint/typecheck/test result — I don't want to report numbers I didn't
actually produce:

```
npm run lint
npx tsc --noEmit
npm run test
```

I'd expect, but have not confirmed: lint clean, the same single
pre-existing `ArchiveBlock/index.tsx` `tsc` error and no new ones, and
all 372+ tests still passing (no test-covered behavior changed — this
phase only narrowed a type and a cast, and added a planning document).

## Existing Payload Status

Unchanged. Default flag-off behavior remains Payload/Stripe, as required.
Not touched this phase.

## Existing Stripe Status

Unchanged. Not touched this phase.

## Remaining payload-types Import Count

**51** — unchanged from the end of Phase 13G. (`FooterComponent` still
imports `payload-types.ts`, just for `Footer` instead of `Footer` +
`Media`.)

## Remaining Blockers

1. **No native `Media.sizes` equivalent.** Unchanged — and worth noting
   precisely: `payload-types.ts`'s generated `Media` interface has no
   `.sizes` field at all today (checked directly this phase). The
   blocker is really "the `Media` display component's responsive-image
   logic requires the full `Media` object," not a specific missing
   field — if/when image-size variants are added to the Payload media
   collection, that's when a literal `.sizes` field would need a native
   equivalent.
2. **CMS `Page['layout']`/`Page['hero']` unions have no native
   equivalent.** Unchanged — now has a full planning document
   (`docs/native-cms-layout-plan.md`) but no implementation.
3. **Cart reducer's own `CartItem`/`Product` type coupling.** Unchanged
   — explicitly out of scope again this phase.

## Recommended Next Phase

Two independent options, not mutually exclusive:

- **Start CMS layout/hero migration, Step 1 only** (per
  `docs/native-cms-layout-plan.md` §5): land the native
  `NativeLayoutBlock`/`NativeHero`/link-reference types in
  `domain/types.ts` with zero consumers — pure addition, no render-layer
  risk, sets up Step 2 (real validation in `layoutRelationsAdapter.ts`,
  which is where the actual risk/uncertainty in this migration lives).
- **Re-audit the Cart provider/reducer coupling** as its own scoped
  phase (not folded into a layout/hero phase) — `AddToCartButton`,
  `RemoveFromCartButton`, `Cart/index.tsx`, `Cart/reducer.ts`, and
  `CheckoutForm` are 5 of the 51 remaining files and are the only
  remaining blocker category with no planning document yet.

Either way: **run the three validation commands above on this phase's
two code changes before starting the next phase**, since they haven't
been machine-verified yet.

============================================================
STOP CONDITION — unchanged
============================================================

Per the phase instructions: STOP here. Do not remove Payload. Do not
remove Stripe. Do not start production cutover. Waiting for explicit
approval before actual Payload removal, Stripe removal, or production
cutover.
