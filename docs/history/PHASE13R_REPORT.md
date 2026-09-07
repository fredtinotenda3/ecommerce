# PHASE 13R IMPLEMENTATION REPORT

## View Models Added

All added to `src/app/_types/storefront.ts` (appended as a new "PHASE 13R"
section; nothing existing in the file was changed).

- **`StorefrontMediaLayoutBlock`** — `{ invertBackground?, position?, id?,
  blockName?, blockType? }`. The subset of the real `payload-types.ts`
  `Page['layout'][number]` `mediaBlock` variant that `MediaBlock` itself
  reads. Mirrors `NativeMediaLayoutBlock` minus `media`. `media` is
  deliberately excluded — same reasoning already established for
  `StorefrontHeroLinksContent` in Phase 13L: `MediaBlock` passes `media`
  straight through to `<Media resource={media} />`
  (`src/app/_components/Media/index.tsx`), which requires the full
  `payload-types.ts` `Media` shape (`Media/types.ts`, not touched this
  phase). `MediaBlock` keeps `media` typed directly against
  `payload-types.ts`'s `Media` in its own local prop type instead.
- **`StorefrontArchiveRelation`** — `{ relationTo: 'products'; value:
  unknown }`. Models a single `populatedDocs` entry. `value` is `unknown`
  rather than a duplicated "full Product" shape or `Record<string,
  unknown>`, because neither `ArchiveBlock` nor `CollectionArchive` reads
  any field off a resolved `value` today (see the type's own doc comment
  for the full trace through `CollectionArchive`'s `as []`-cast initial
  state), and because `payload-types.ts`'s generated `Product` interface
  has no index signature, so it is not assignable to `Record<string,
  unknown>` even though it's a plain object — a TypeScript-specific
  pitfall `unknown` avoids.
- **`StorefrontArchiveBlock`** — `{ introContent, populateBy?, relationTo?,
  categories?, limit?, populatedDocs?, populatedDocsTotal?, id?,
  blockName?, blockType? }`. The subset of the real `archive` block variant
  that `ArchiveBlock` (and, through `ArchiveBlockProps`, `CollectionArchive`)
  actually reads. Mirrors `NativeArchiveBlock` minus `selectedDocs` (never
  destructured by `ArchiveBlock`). `categories` is widened to `string[] |
  StorefrontCategory[]` (reusing the existing Phase 13F-B
  `StorefrontCategory` type) rather than `NativeArchiveBlock`'s
  `string[]`-only modelling, since a real Payload archive block's
  `categories` can genuinely be a populated `Category[]`.

## Components Migrated

- **`src/app/_blocks/MediaBlock/index.tsx`** — `Props` re-typed from
  `Extract<Page['layout'][0], { blockType: 'mediaBlock' }>` (`Page` from
  `payload-types.ts`) to `StorefrontMediaLayoutBlock & { media: string |
  MediaType; staticImage?: StaticImageData; id?: string }`. The
  `payload-types.ts` import narrows from the full `Page` type to just
  `Media` (aliased `MediaType`, matching the existing convention already
  used in `HighImpactHero`/`MediumImpactHero`). Render logic (`position`
  branching, `caption` extraction, `<Media>`/`<Gutter>`/`<RichText>` calls)
  is byte-for-byte unchanged.
- **`src/app/_blocks/ArchiveBlock/types.ts`** — `ArchiveBlockProps`
  re-typed from `Extract<Page['layout'][0], { blockType: 'archive' }>`
  (`Page` from `payload-types.ts`) to the new `StorefrontArchiveBlock`,
  re-exported. The `payload-types.ts` import is now gone from this file
  entirely. `ArchiveBlock/index.tsx` itself required no changes — it only
  imports the `ArchiveBlockProps` alias from this file, and its own
  destructuring/JSX is untouched.

## Files Created

- `tests/storefrontCmsMediaArchiveBlocks.test.ts`

## Files Modified

- `src/app/_types/storefront.ts`
- `src/app/_blocks/MediaBlock/index.tsx`
- `src/app/_blocks/ArchiveBlock/types.ts`

## Files Deleted

None

## Files Intentionally Left Unchanged

- **`src/app/_blocks/ArchiveBlock/index.tsx`** — only consumes
  `ArchiveBlockProps` from `types.ts`; needed no direct edit since the
  alias it imports changed shape underneath it, not its own declaration.
- **`src/app/_components/CollectionArchive/index.tsx`** — its own `Props`
  type derives `populatedDocs`/`populatedDocsTotal`/`categories` from
  `ArchiveBlockProps` via indexed access (`ArchiveBlockProps['populatedDocs']`,
  etc.), so it follows the `ArchiveBlockProps` type change automatically.
  It still imports `Category`/`Product` from `payload-types.ts` directly
  for its own unrelated `Result`/API-fetch typing — out of scope for this
  phase (not `MediaBlock`/`ArchiveBlock` themselves) and not requested.
- **`src/app/_components/Media/index.tsx` and `Media/types.ts`** —
  untouched, per the phase's explicit instruction.
- **`src/app/_components/Blocks/index.tsx`, `Hero/index.tsx`** — already
  migrated in Phase 13Q; not touched again here. `Blocks`' existing
  `// @ts-expect-error` boundary cast (documented in Phase 13Q) continues
  to cover the spread into whichever block component — including the two
  migrated in this phase — is selected at runtime.
- **`layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`,
  `productStorefrontAdapter.ts`, Cart provider/reducer** — untouched, per
  the phase's explicit "DO NOT" list.

## Existing Payload Status

Unchanged. Payload remains the default data source; no Payload dependency,
collection, or adapter was removed, added to, or had its behavior altered.
`MediaBlock`/`ArchiveBlock` still ultimately render real Payload-authored
block data by default, unchanged in output.

## Existing Stripe Status

Unchanged. Nothing in this phase touches pricing, checkout, or payment
code paths.

## Remaining payload-types Import Count

Using the same methodology as prior phases'
(`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13R: 36**
- **After Phase 13R: 35**

The one-file reduction is `src/app/_blocks/ArchiveBlock/types.ts` dropping
its `Page` import entirely. `src/app/_blocks/MediaBlock/index.tsx` remains
in the count — it still imports `payload-types.ts`, just for `Media`
instead of `Page` now (a narrower, intentional dependency documented
inline, matching the existing `HighImpactHero`/`MediumImpactHero`
convention).

## Remaining Blockers

- CMS `Page['layout']`/`Page['hero']` discriminated unions: with this
  phase, all four real block variants' *leaf* components
  (`CallToActionBlock`/`ContentBlock` from Phase 13L, `MediaBlock`/
  `ArchiveBlock` from this phase) and both dispatchers (`Blocks`/`Hero`
  from Phase 13Q) are now on dedicated storefront view models. What
  remains on this boundary: the individual `_heros/*` components already
  migrated in Phase 13L keep their own locally-typed `media` field against
  `payload-types.ts`'s `Media` (same pattern as `MediaBlock` here, and for
  the same reason — `Media/types.ts` is out of scope); and the page files
  themselves (`[slug]/page.tsx`, `products/page.tsx`, `cart/page.tsx`)
  still hold a full `payload-types.ts` `Page` for unrelated reasons
  (`fetchDoc<Page>`, `generateStaticParams`, `generateMeta`).
- Adapter/fetch compatibility boundaries — untouched, per the "DO NOT"
  list (`layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`,
  `productStorefrontAdapter.ts` not modified).
- The pre-existing, unrelated `tsc` error in
  `src/app/_blocks/ArchiveBlock/index.tsx:40` (`sort` prop not on
  `CollectionArchive`'s own `Props` type) remains, unaffected by this
  phase's changes (it now references `StorefrontArchiveRelation`/
  `StorefrontCategory` in its error message instead of the old
  `payload-types.ts`-derived types, but the underlying mismatch — a
  `sort="-publishedOn"` prop `ArchiveBlock` passes that `CollectionArchive`'s
  own `Props` type doesn't declare — predates this phase and is out of
  scope, since `CollectionArchive` was not a component this phase was
  asked to migrate).
- The same two pre-existing, unrelated `eslint` errors from Phase 13Q
  persist (`Cart/reducer.ts`, and a `T[]` vs `Array<T>` style hit inside
  `storefront.ts` at a line this phase did not touch).

## Recommended Next Phase

The remaining `payload-types.ts`-derived surface left in the CMS
layout/hero area is now mostly the "media stays fully typed" seams
(`MediaBlock`, `HighImpactHero`, `MediumImpactHero`) and the three page
files' own `Page` fetch typing. A reasonable **Phase 13S** would tackle
the adapter/fetch compatibility boundary named at the top of this and the
prior phase's kickoff (`layoutRelationsAdapter.ts`/`pageStorefrontAdapter.ts`/
`productStorefrontAdapter.ts`), since the CMS-block/hero side of the "hard
boundaries" list is now substantially closed at both the dispatcher and
leaf-component layers.
