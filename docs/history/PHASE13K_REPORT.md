# PHASE 13K IMPLEMENTATION REPORT

## Files Migrated to NativeCMSLink

No file was retyped to the literal `NativeCMSLink` interface — doing so would have broken
compilation, not just behavior (see "Why not a literal swap" below). Instead, every target
file was migrated onto a new **`NativeCMSLink`-derived** view-model chain, added to
`src/app/_types/storefront.ts`:

```
NativeCMSLink (src/lib/domain/types.ts)
  -> StorefrontCMSLink   (Omit<NativeCMSLink, 'reference' | 'icon' | 'label'> & narrower fields)
  -> StorefrontNavItem   ({ id?, link: StorefrontCMSLink })
  -> StorefrontHeader    ({ navItems?: StorefrontNavItem[] })
  -> StorefrontFooter    ({ copyright?, navItems?: StorefrontNavItem[] })
```

`StorefrontCMSLink` keeps `type` / `newTab` / `url` / `appearance` exactly as declared on
`NativeCMSLink`, and only narrows the three fields where the real data (both the default
Payload/GraphQL path and the native `globalsStorefrontAdapter.ts` path) is structurally
incompatible with the domain type's own vocabulary:

| Field       | `NativeCMSLink`             | `StorefrontCMSLink`                                   | Why narrowed |
|-------------|------------------------------|--------------------------------------------------------|--------------|
| `reference` | `value: string \| Page` (domain `Page`, requires `status`/`layout`/`hero`/etc.) | `value: string \| StorefrontLinkablePage` (`{ slug?: string \| null }`) | Every real caller only ever populates `{ slug }`, never a full domain `Page`. |
| `icon`      | `string \| Media` (domain `Media`) | `string \| StorefrontMediaItem` (scalar subset) | Same reasoning, using the existing Phase 13H `StorefrontMediaItem` subset. |
| `label`     | required `string`           | optional `string`                                      | Matches the pre-13K `CMSLinkType` (Payload's generated type marks it required, but this is defensive against the real data not always populating it). |

**Files now typed against this chain (rather than `payload-types.ts`):**
- `src/app/_components/Header/index.tsx` — `header: StorefrontHeader | null`
- `src/app/_components/Header/HeaderComponent/index.tsx` — `header: StorefrontHeader | null`
- `src/app/_components/Header/Nav/index.tsx` — `header: StorefrontHeader | null`
- `src/app/_components/Footer/index.tsx` — `footer: StorefrontFooter | null`
- `src/app/_components/Footer/FooterComponent/index.tsx` — `footer: StorefrontFooter | null`
- `src/app/_components/Link/index.tsx` (`CMSLink`) — its prop type `CMSLinkType` is now
  `Omit<StorefrontCMSLink, 'appearance' | 'label' | 'icon'> & { ... }` instead of a
  hand-written, unrelated interface.

**Why not a literal swap onto `NativeCMSLink`:** `NativeCMSLink.reference.value` is
`string | Page` where `Page` is the *domain* `Page` interface (requires `status`, `layout`,
`hero`, `meta`, `createdAt`, `updatedAt`, etc.). Neither the default Payload/GraphQL path
(`payload-types.ts`'s own `Page`, which has a differently-shaped `meta` and no `status`
field visible to the storefront) nor the native `globalsStorefrontAdapter.ts` path (which
only ever resolves `{ slug }`) can satisfy that shape. Typing `HeaderNav`/`CMSLink`
directly against `NativeCMSLink` would have been a genuine regression — a compile break for
every real caller, not just a theoretical mismatch — so the safe migration is the
`Omit`-derived `StorefrontCMSLink` chain above, which **is** structurally rooted in
`NativeCMSLink` (same `type`/`newTab`/`url`/`appearance` fields, same relationship pattern
as `NativeLinkGroupItem`) while keeping the three genuinely-different fields at the
narrower, already-established "storefront view model" precision (same pattern as
`StorefrontLinkablePage`/`StorefrontMediaItem`, added in earlier phases).

## Behavior Preserved

- **Rendering output**: `CMSLink`'s JSX branches (`Link` vs `Button`, `label`/`children`
  fallthrough) are untouched.
- **Href resolution logic**: extracted verbatim into `resolveCMSLinkHref()`
  (`src/app/_components/Link/resolveHref.ts`) — same expression, same operator precedence,
  same `reference?.relationTo !== 'pages'` defensive branch, just given a name and a home
  outside the component so it's unit-testable.
- **External link vs internal reference handling**: unchanged — `type === 'reference'` with
  a populated (object) `reference.value.slug` still builds `/{slug}`; everything else still
  falls back to `url`.
- **Null/undefined handling**: `CMSLink` still returns `null` when `href` is falsy;
  `HeaderNav`/`FooterComponent` still null-guard `header?.navItems` / `footer?.navItems` /
  `footer?.copyright`.
- **Styling/class names**: no `classes.*` reference, `className` prop, or CSS module import
  was touched in any file.
- **FooterComponent's icon narrowing**: the pre-existing `as unknown as StorefrontMediaItem`
  cast is preserved (now `as StorefrontMediaItem | undefined`, since the source type is now
  accurately `string | StorefrontMediaItem | undefined` instead of `unknown`) — same runtime
  assumption (icon is always populated by the time it reaches this component), same
  behavior, slightly more honest typing.

## Files Created

- `src/app/_components/Link/resolveHref.ts` — extracted, exported `resolveCMSLinkHref()`
  pure function (see "Behavior Preserved" above).
- `tests/resolveCMSLinkHref.test.ts` — 7 unit tests covering every branch of the extracted
  href-resolution logic (internal reference → `/{slug}`, unresolved string reference →
  `url` fallback, missing slug, custom link, undefined `type`, fully-empty input, malformed
  reference with no `value`).
- `tests/storefrontCmsLink.test.ts` — 7 tests: type-level construction tests for
  `StorefrontCMSLink` (custom/reference/unresolved-string variants), plus runtime tests
  proving both real producers — `payload-types.ts`-shaped `Header`/`Footer` objects (default
  path) and `globalsStorefrontAdapter.ts`'s `toStorefrontHeader`/`toStorefrontFooter` output
  (native path) — are still assignable to `StorefrontHeader`/`StorefrontFooter` unchanged.

## Files Modified

- `src/app/_types/storefront.ts` — added `StorefrontCMSLink`, `StorefrontNavItem`,
  `StorefrontHeader`, `StorefrontFooter` (imports `NativeCMSLink` from
  `src/lib/domain/types.ts`); no existing exports changed.
- `src/app/_components/Link/index.tsx` — `CMSLinkType` now derived from `StorefrontCMSLink`;
  href logic delegated to `resolveCMSLinkHref()`; no behavioral change.
- `src/app/_components/Header/index.tsx` — `header` narrowed from `payload-types.ts`'s
  `Header` to `StorefrontHeader`.
- `src/app/_components/Header/HeaderComponent/index.tsx` — same narrowing, prop passthrough
  only.
- `src/app/_components/Header/Nav/index.tsx` — same narrowing; `CMSLink` spread call site
  (`{...link}`) unchanged.
- `src/app/_components/Footer/index.tsx` — `footer` narrowed from `payload-types.ts`'s
  `Footer` to `StorefrontFooter`.
- `src/app/_components/Footer/FooterComponent/index.tsx` — same narrowing; `icon` cast
  updated to match the now-accurate `string | StorefrontMediaItem | undefined` source type
  (see "Behavior Preserved").

## Files Deleted

(none)

## New Dependencies

(none)

## Existing Payload Status

Unchanged. Payload remains the default data source. `payload-types.ts` is untouched, still
generated from the live Payload config, and still the source of truth for every field this
phase's narrowed types describe a subset of. The default (flag-off) GraphQL path in
`src/app/_api/fetchGlobals.ts` was not modified and still returns real `payload-types.ts`
`Header`/`Footer` objects, which — per this phase's tests — remain assignable to the new
narrower `StorefrontHeader`/`StorefrontFooter` prop types unchanged.

## Existing Stripe Status

Unchanged. Not touched by this phase; no Stripe-related file was in scope.

## Remaining payload-types Import Count

Using the same methodology as prior phase reports
(`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13K: 51**
- **After Phase 13K: 46**

The 5 files that dropped their `payload-types.ts` import are exactly the 5 target files
narrowed to `StorefrontHeader`/`StorefrontFooter` in this phase:
`src/app/_components/Header/index.tsx`, `Header/HeaderComponent/index.tsx`,
`Header/Nav/index.tsx`, `Footer/index.tsx`, `Footer/FooterComponent/index.tsx`.

`layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`, and `productStorefrontAdapter.ts`
still import `payload-types.ts` and were not touched (out of scope / explicitly excluded).

## Remaining Blockers

- `pageStorefrontAdapter.ts` and `productStorefrontAdapter.ts` still use unchecked
  Payload-shaped casts (unchanged from Phase 13J — out of scope for 13K).
- The hero/block components (`CallToAction`, `Content`, `HighImpact`, `MediumImpact`,
  `CustomHero`, `RichText/serialize.tsx`) still type their `link`/`reference` props against
  `Page['layout'][...]` / `Page['hero']` from `payload-types.ts` — these were explicitly
  excluded from this phase ("CMS block/hero components other than link/nav consumers") and
  were left unchanged. They continue to compile and pass their existing `CMSLink` calls
  unchanged, since `CMSLinkType`'s narrowing only removed `icon` (never read by `CMSLink`)
  and widened nothing incompatibly.
- A pre-existing, unrelated `tsc --noEmit` error in `src/app/_blocks/ArchiveBlock/index.tsx`
  (a `sort` prop not present on that block's `Props` type) was confirmed present in the
  unmodified Phase 13J baseline before this phase's changes — not introduced by, and not
  fixed by, Phase 13K.

## Recommended Next Phase

Migrate the CMS block/hero components (`CallToAction`, `Content`, `HighImpact`,
`MediumImpact`, `CustomHero`, `RichText/serialize.tsx`) onto the same
`StorefrontCMSLink`/`NativeCMSLink`-derived chain established here, now that `CMSLink`
itself accepts it — this would let those components' `link`/`reference` props narrow away
from `Page['layout'][...]`/`Page['hero']` (from `payload-types.ts`) the same way
Header/Footer/CMSLink did in this phase, continuing to reduce the `payload-types.ts` import
count without touching rendering behavior.
