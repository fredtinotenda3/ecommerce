# PHASE 13L IMPLEMENTATION REPORT

## Files Migrated

Six of the seven files listed as likely targets were migrated onto the `StorefrontCMSLink`/
`NativeCMSLink`-derived view-model chain from Phase 13K. `RichText/serialize.tsx` was
inspected but required no change (see "Remaining Blockers" for why).

New view models were added to `src/app/_types/storefront.ts`, following the exact
derivation pattern Phase 13K used for `StorefrontHeader`/`StorefrontFooter`:

```
NativeCallToActionBlock (src/lib/domain/types.ts)
  -> StorefrontCallToActionBlock  (links: NativeLinkGroupItem[] -> StorefrontLinkGroupItem[])

NativeContentBlock / NativeContentColumn
  -> StorefrontContentBlock / StorefrontContentColumn  (link: NativeCMSLink -> StorefrontCMSLink)

NativeHero (minus `media` — see below)
  -> StorefrontHeroLinksContent  (richText + links only)

Page['hero'] (richText-only slice)
  -> StorefrontLowImpactHero
```

`StorefrontLinkGroupItem` is a same-shape alias of the existing `StorefrontNavItem`
(`{ id?, link: StorefrontCMSLink }`), kept as a separate name so `hero.links` / `cta.links`
call sites read as "a list of CMS links" (matching Payload's own field naming), the same
way `StorefrontNavItem` reads as "a nav item."

**Files now typed against this chain (rather than `payload-types.ts`):**
- `src/app/_blocks/CallToAction/index.tsx` — `Props = StorefrontCallToActionBlock`
- `src/app/_blocks/Content/index.tsx` — `Props = StorefrontContentBlock`
- `src/app/_heros/LowImpact/index.tsx` — `React.FC<StorefrontLowImpactHero>`
- `src/app/_heros/CustomHero/index.tsx` — `StorefrontHeroLinksContent & { media?: string | StorefrontMediaItem }`
- `src/app/_heros/HighImpact/index.tsx` — `StorefrontHeroLinksContent & { media: string | MediaType }`
  (payload-types `Media` type kept — see below)
- `src/app/_heros/MediumImpact/index.tsx` — same as HighImpact

**Why `media` is NOT part of the shared hero view model:** `HighImpactHero`/
`MediumImpactHero` pass their hero's `media` field straight through to
`<Media resource={media} />`, whose prop type (`src/app/_components/Media/types.ts`,
explicitly out of scope for this phase — "DO NOT modify Media/responsive media logic") is
`string | MediaType`, where `MediaType` is `payload-types.ts`'s full `Media` interface
(needed for `.sizes`, used by that component's responsive-image logic). Narrowing `media`
to a scalar subset the way `icon`/`reference.value` were narrowed in Phase 13K would make it
unsafe to pass into `<Media />` — a genuine compile break, not just a theoretical mismatch.
So:
- `HighImpactHero`/`MediumImpactHero` keep `media: string | MediaType`, importing only the
  `Media` type from `payload-types.ts` (not `Page`) — their `richText`/`links` fields still
  narrow onto `StorefrontHeroLinksContent`.
- `CustomHero` never passes `media` to `<Media />` — it only reads `.filename` off it to
  build a CSS `background-image` URL — so it safely narrows to
  `string | StorefrontMediaItem` (the existing Phase 13H scalar-subset type), dropping the
  `payload-types.ts` import entirely.
- `LowImpactHero` never reads `media` (or `links`) at all, so its type is `richText` only.

## Behavior Preserved

- **Rendering output**: no JSX structure, conditional branch, `classes.*` reference, or
  className was touched in any of the six files.
- **Link classification/reference handling**: unchanged — every `<CMSLink {...link} />` /
  `<CMSLink key={i} {...link} invert={invertBackground} />` call site is untouched; the
  underlying `resolveCMSLinkHref()` logic (Phase 13K) was not modified.
- **External vs internal link handling**: unchanged, same reasoning as above — the new
  types are structural supersets/subsets of the same real data, not a different shape.
- **Null/undefined handling**: unchanged — `Array.isArray(links) && links.length > 0` /
  `columns && columns.length > 0` / `typeof media === 'object'` guards are byte-for-byte
  the same in every file.
- **Media rendering**: `HighImpactHero`/`MediumImpactHero` still pass `media` to
  `<Media resource={media} priority />` / `<Media resource={media} />` with the exact same
  `string | Media` (payload-types) type it always had — zero change to what that component
  receives or how it renders. `CustomHero`'s `mediaUrl` computation
  (`typeof media !== 'string' && ...media.filename`) is untouched; `StorefrontMediaItem`
  includes `.filename` so this still type-checks.
- **CustomHero's unused `Media` import**: the pre-existing file imported the `Media` display
  component (`import { Media } from '../../_components/Media'`) but never rendered it (only
  `media.filename` was read, for the CSS background). This dead import was removed as part
  of the migration — a compile-time-only change with no runtime/behavioral effect (verified:
  no JSX in the file references `<Media`).
- **Styling/class names**: no `.module.scss` file was touched; no CSS module import was
  added, removed, or renamed.

## Files Created

- `tests/storefrontCmsBlocks.test.ts` — 7 tests:
  - `StorefrontCallToActionBlock` accepts a minimal (no-links) block and a real
    `payload-types.ts` `cta` block unchanged.
  - `StorefrontContentBlock`/`StorefrontContentColumn` accept a column with no link, and a
    real `payload-types.ts` `content` block (with a populated internal reference link)
    unchanged.
  - `StorefrontHeroLinksContent` accepts the `richText`/`links` subset of a real
    `payload-types.ts` `Page['hero']` object unchanged.
  - `StorefrontLowImpactHero` accepts a real `payload-types.ts` `Page['hero']` object
    (structural subset — extra `type`/`media` fields ignored) unchanged.
  - `StorefrontLinkGroupItem` only requires an optional `id`, matching `StorefrontNavItem`.

## Files Modified

- `src/app/_types/storefront.ts` — added `StorefrontRichText`, `StorefrontLinkGroupItem`,
  `StorefrontCallToActionBlock`, `StorefrontContentColumn`, `StorefrontContentBlock`,
  `StorefrontLowImpactHero`, `StorefrontHeroLinksContent`. No existing exports changed.
- `src/app/_blocks/CallToAction/index.tsx` — `Props` type narrowed; `payload-types.ts`
  import dropped.
- `src/app/_blocks/Content/index.tsx` — `Props` type narrowed; `payload-types.ts` import
  dropped.
- `src/app/_heros/HighImpact/index.tsx` — `richText`/`links` narrowed via
  `StorefrontHeroLinksContent`; `media` kept against `payload-types.ts`'s `Media` (import
  narrowed from `Page` to just `Media`).
- `src/app/_heros/MediumImpact/index.tsx` — same as HighImpact.
- `src/app/_heros/CustomHero/index.tsx` — `richText`/`links` narrowed via
  `StorefrontHeroLinksContent`; `media` narrowed to `string | StorefrontMediaItem`;
  `payload-types.ts` import dropped; unused `Media` component import removed.
- `src/app/_heros/LowImpact/index.tsx` — prop type narrowed to `StorefrontLowImpactHero`;
  `payload-types.ts` import dropped.

## Files Deleted

(none)

## New Dependencies

(none)

## Existing Payload Status

Unchanged. Payload remains the default (flag-off) data source. `payload-types.ts` itself
was not touched — every new storefront type is a structural subset defined independently in
`src/app/_types/storefront.ts`, verified (via the new tests) to still accept real
`payload-types.ts` `Page['layout'][number]` / `Page['hero']` objects unchanged. The default
GraphQL page-fetch path was not modified.

## Existing Stripe Status

Unchanged. Not touched by this phase; no Stripe-related file was in scope.

## Remaining payload-types Import Count

Using the same methodology as the Phase 13K report
(`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13L: 46**
- **After Phase 13L: 42**

The 4 files that dropped their `payload-types.ts` import are exactly the 4 target files
narrowed to types with no full-`Media`/`Page` dependency:
`src/app/_blocks/CallToAction/index.tsx`, `src/app/_blocks/Content/index.tsx`,
`src/app/_heros/CustomHero/index.tsx`, `src/app/_heros/LowImpact/index.tsx`.

`src/app/_heros/HighImpact/index.tsx` and `src/app/_heros/MediumImpact/index.tsx` still
import `payload-types.ts`, narrowed from `Page` to just `Media` — this is a deliberate,
in-scope decision (not a shortfall): their `media` prop is passed straight through to the
unmodified `<Media />` display component, which requires the full Payload `Media` shape.
Removing that import would require either modifying `Media/types.ts` (explicitly
prohibited by this phase's DO NOT list) or introducing an unsound cast, neither of which is
"reducing dependence on `payload-types.ts` without changing rendering or behavior." Their
`richText`/`links` fields were still migrated.

## Remaining Blockers

- `src/app/_components/RichText/serialize.tsx` was inspected but required no change: it
  already has zero `payload-types.ts` dependency. Its `link` case passes
  `reference={node.doc as any}` to `CMSLink` — already untyped/unchecked against any Payload
  shape, pre-dating this phase. No further narrowing is possible or needed there.
- `HighImpactHero`/`MediumImpactHero` still import `payload-types.ts`'s `Media` type (see
  above) — closing this gap would require touching `Media/types.ts`, out of scope per this
  phase's DO NOT list.
- The pre-existing, unrelated `tsc --noEmit` error in `src/app/_blocks/ArchiveBlock/index.tsx`
  (a `sort` prop not present on that block's `Props` type) remains, confirmed present in the
  unmodified baseline before this phase's changes — not introduced by, and not fixed by,
  Phase 13L.
- `pageStorefrontAdapter.ts` and `productStorefrontAdapter.ts` still use unchecked
  Payload-shaped casts (unchanged from Phase 13J/13K — explicitly out of scope for 13L per
  the DO NOT list).

## Recommended Next Phase

- Audit the remaining 42 files that import `payload-types.ts` (`src/app/_components/Card`,
  `CollectionArchive`, `AddToCartButton`, `RemoveFromCartButton`, `MediaBlock`,
  `RelatedProducts`, `PaywallBlocks`, the `(pages)/**` route files, etc.) for the same
  "narrow to a storefront view model" treatment where the consumed fields are a genuine
  structural subset (scalar reads, no `.sizes`/full-relation dependency) — continuing to
  shrink the count without touching `Media/types.ts`, the adapters, or CMS union types
  directly, per the same constraints honored in this phase.
- If/when `Media/types.ts`'s responsive-image logic is revisited in a future, explicitly
  scoped phase, `HighImpactHero`/`MediumImpactHero` become candidates to drop their
  remaining `payload-types.ts` import too.
