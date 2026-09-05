# PHASE 13Q IMPLEMENTATION REPORT

## View Models Added

All added to `src/app/_types/storefront.ts` (appended as a new "PHASE 13Q"
section; nothing existing in the file was changed except the top-of-file
domain-type import line, which now also pulls in `NativeHeroType` and
`NativeLayoutBlock` alongside the existing `NativeCMSLink`).

- **`StorefrontLayoutBlockType`** — `NativeLayoutBlock['blockType']`, i.e.
  `'cta' | 'content' | 'mediaBlock' | 'archive'`, pulled off the native
  discriminated union via indexed access rather than re-typed by hand, so it
  can't drift from `src/lib/domain/types.ts`.
- **`StorefrontLayoutBlock`** — `{ id?, blockName?, blockType:
  StorefrontLayoutBlockType, invertBackground? }`. The subset of every real
  CMS-authored layout block (`payload-types.ts`'s `Page['layout'][number]`,
  and `NativeLayoutBlock`) that the `Blocks` *dispatcher* itself reads to
  pick a renderer and compute background-inversion/padding — not a
  discriminated union of the four full per-block-type shapes, since the
  dispatcher never narrows past a plain `blockType in blockComponents`
  membership check.
- **`StorefrontHero`** — `{ type: NativeHeroType }`. The subset of every
  real `Page['hero']` (`payload-types.ts`, and a `NativeHero`-shaped object)
  that the `Hero` *dispatcher* itself reads to pick a renderer or render
  nothing for `'none'`/an unrecognized type.

Both are deliberately much smaller than the Phase 13L per-block/hero-variant
view models (`StorefrontCallToActionBlock`, `StorefrontContentBlock`,
`StorefrontHeroLinksContent`, `StorefrontLowImpactHero`) — those exist for
the individual `_blocks/*`/`_heros/*` rendering components (which read a
fuller field set per variant); these two exist one layer up, for the
dispatchers, which read almost nothing.

## Page/Dispatcher Files Migrated

- **`src/app/_components/Blocks/index.tsx`** — `blocks` prop re-typed from
  `(Page['layout'][0] | RelatedProductsProps)[]` (`Page` imported from
  `payload-types.ts`) to `(StorefrontLayoutBlock | RelatedProductsProps)[]`.
  The `payload-types.ts` import is now gone from this file entirely. The
  dispatch logic (`blockType in blockComponents`, `invertBackground`
  probing via `'invertBackground' in block`, padding/inversion computation,
  the `<Block ... {...block} />` render) is byte-for-byte unchanged; only a
  documentation comment was added above the pre-existing
  `// @ts-expect-error` boundary cast explaining why it still covers the
  spread under the new, narrower `block` type.
- **`src/app/_components/Hero/index.tsx`** — Props re-typed from
  `Page['hero']` (`Page` from `payload-types.ts`) to `StorefrontHero`. The
  `payload-types.ts` import is now gone from this file entirely. Dispatch
  logic (`type === 'none'` check, `heroes[type]` lookup, fallback to
  `null`) is unchanged. A new, documented `@ts-expect-error` was added at
  the `<HeroToRender {...props} />` line — the one place the narrower
  dispatcher-level type is spread into whichever full-shaped `_heros/*`
  component was selected.

## Files Created

- `tests/storefrontCmsDispatcher.test.ts` — type-level regression tests
  (see "Existing Payload Status" / task 5 below for what they establish).

## Files Modified

- `src/app/_types/storefront.ts`
- `src/app/_components/Blocks/index.tsx`
- `src/app/_components/Hero/index.tsx`

## Files Deleted

(none)

## Files Intentionally Left Unchanged

- **`src/app/(pages)/[slug]/page.tsx`**, **`src/app/(pages)/products/page.tsx`**,
  **`src/app/(pages)/cart/page.tsx`** — each still holds a full
  `payload-types.ts` `Page` (via `fetchDoc<Page>`/`fetchPageNative`, and the
  `staticHome`/`staticCart` seed fallbacks), and still needs that import for
  other reasons untouched by this phase (`generateStaticParams`,
  `generateMeta`, `fetchDocs<Page>`). Their existing calls —
  `<Hero {...hero} />`, `<Blocks blocks={layout} .../>`,
  `<Blocks blocks={page?.layout} .../>` — type-check unchanged against the
  new, narrower `StorefrontHero`/`StorefrontLayoutBlock` dispatcher prop
  types with zero code changes, because a full `Page['hero']` /
  `Page['layout']` object always satisfies the narrower view model. No
  edits were needed or made to these three files.
- **`src/app/(pages)/products/[slug]/page.tsx`** — passes a hand-built
  literal `relatedProducts` block to `Blocks`, which is a separate,
  untouched union member (`RelatedProductsProps`) both before and after
  this phase; it never touches `Page['layout']`/`Page['hero']` at all, so
  it was inspected but required no change.
- **All `_blocks/*` and `_heros/*` components** — left on their existing
  prop types per the phase's explicit "DO NOT" list. `CallToActionBlock`/
  `ContentBlock`/`LowImpactHero`/`HighImpactHero`/`MediumImpactHero`/
  `CustomHero` were already migrated in earlier phases (13L); `MediaBlock`/
  `ArchiveBlock` remain on full `payload-types.ts`-derived types.
- **`layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`,
  `productStorefrontAdapter.ts`** — untouched, per the phase's explicit
  "DO NOT" list.
- **Cart provider/reducer** — untouched, per the phase's explicit "DO NOT"
  list (and already closed as of Phase 13P).

## Existing Payload Status

Unchanged. Payload remains the default data source; `isNativeRepositoryEnabled()`
flag-gated native paths are untouched; no Payload dependency, collection,
or adapter was removed, added to, or had its behavior altered. The pages
inspected for this phase still fetch real Payload-shaped `Page` documents
by default and pass them through to `Blocks`/`Hero` unchanged.

## Existing Stripe Status

Unchanged. Nothing in this phase touches pricing, checkout, or payment
code paths.

## Remaining payload-types Import Count

Using the same methodology as prior phases'
(`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13Q: 37**
- **After Phase 13Q: 36**

The one-file reduction comes from `src/app/_components/Hero/index.tsx`
dropping its `Page` import entirely. `src/app/_components/Blocks/index.tsx`
also had its `Page` import removed, but that file's import string already
ended in `payload-types.js'` (a `.js` extension on the import path) prior
to this phase, which does not match the grep pattern used by this
methodology (`from '.*payload-types'` requires the string to end exactly at
`payload-types'`) — so it was not counted in the "Before" figure either,
despite genuinely importing from `payload-types.ts` at runtime. Its import
removal is a real cleanup (one fewer place depending on the generated
Payload types) but does not move this particular metric. This quirk in the
counting methodology predates Phase 13Q and was not altered.

The three page files inspected (`[slug]/page.tsx`, `products/page.tsx`,
`cart/page.tsx`) remain in the count — they still need `Page` from
`payload-types.ts` for `fetchDoc<Page>`/`generateStaticParams`/`generateMeta`,
none of which this phase's scope (the `Blocks`/`Hero` boundary only)
authorized touching.

## Remaining Blockers

- The two hard boundaries named in the phase kickoff remain:
  1. CMS `Page['layout']`/`Page['hero']` discriminated unions — this phase
     migrated the *dispatcher* layer only (`Blocks`/`Hero` themselves); the
     individual `_blocks/*`/`_heros/*` components, and the three page files
     that still hold a full `Page`, remain on `payload-types.ts`-derived
     types by design (explicitly out of scope this phase).
  2. Adapter/fetch compatibility boundaries — untouched, per the "DO NOT"
     list (`layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`,
     `productStorefrontAdapter.ts` not modified).
- A pre-existing, unrelated `tsc` error in
  `src/app/_blocks/ArchiveBlock/index.tsx:40` (`sort` prop not on `Props`)
  was present before this phase's changes and is unaffected by them — not
  a Phase 13Q regression, but worth flagging as an existing gap in that
  component's own prop type (out of scope here since `_blocks/*` components
  are on the "DO NOT modify" list).
- Two pre-existing, unrelated `eslint` errors
  (`src/app/_providers/Cart/reducer.ts:20`, and a `T[]` vs `Array<T>` style
  rule hit inside `src/app/_types/storefront.ts` at a line this phase did
  not touch) were present before this phase's changes and are unaffected by
  them.

## Recommended Next Phase

With the `Blocks`/`Hero` dispatcher boundary closed, a natural **Phase
13R** would migrate `MediaBlock` and `ArchiveBlock` (the two `_blocks/*`
components still on full `payload-types.ts`-derived `Extract<Page['layout'][0],
...>` types) onto dedicated `StorefrontMediaLayoutBlock`/`StorefrontArchiveBlock`
view models, following the exact pattern Phase 13L already established for
`CallToActionBlock`/`ContentBlock` — this would be the next incremental
step on hard boundary #1, still without touching the adapter/fetch layer
(hard boundary #2), which remains a separate, later piece of work.
