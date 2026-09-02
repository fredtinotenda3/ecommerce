# Native CMS Layout/Hero Migration — Planning Document

PHASE 13H — planning only. Nothing in this document is implemented in this
phase; no `Page['layout']`/`Page['hero']` consumer or CMS block/link union
type is touched. This is the design record the future implementation phase
should start from.

## 1. Current Payload `Page['layout']` / `Page['hero']` shape

Both live on `payload-types.ts`'s generated `Page` interface
(`src/payload/payload-types.ts`) and are **required, non-optional**
fields — every `Page` has a `hero` object and a `layout` array, even if
empty/`type: 'none'`.

### `Page['hero']`

```ts
hero: {
  type: 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact' | 'customHero'
  richText: { [k: string]: unknown }[]
  links?: { link: CMSLinkShape; id?: string }[]
  media: string | Media
}
```

### `Page['layout']`

A discriminated union array, keyed on `blockType`, with four members today:

| `blockType` | Notable fields |
|---|---|
| `cta` | `invertBackground?`, `richText`, `links?: { link: CMSLinkShape }[]` |
| `content` | `invertBackground?`, `columns?: { size?, richText, enableLink?, link? }[]` |
| `mediaBlock` | `invertBackground?`, `position?: 'default' \| 'fullscreen'`, `media: string \| Media` |
| `archive` | `introContent`, `populateBy?`, `relationTo?: 'products'`, `categories?`, `limit?`, `selectedDocs?`, `populatedDocs?`, `populatedDocsTotal?` |

Every member also carries `id?`, `blockName?`, `blockType` (the
discriminant). `Product['layout']` reuses the exact same four block
shapes verbatim (see `payload-types.ts`) — this plan covers both, since
they're structurally identical.

The recurring `CMSLinkShape` embedded in `hero.links`, `cta.links`, and
`content.columns[].link` is itself a small union:

```ts
{
  type?: 'reference' | 'custom'
  newTab?: boolean
  reference: { relationTo: 'pages'; value: string | Page }
  url: string
  label: string
  icon?: string | Media
  appearance?: 'default' | 'primary' | 'secondary' // varies slightly per site
}
```

A fifth "block", `relatedProducts`, exists only in `RelatedProducts/index.tsx`'s
own `RelatedProductsProps` — it's synthesized by `ProductHero`/product
pages at render time, not a real Payload block type. Any native block enum
should account for it as a UI-only concern, not a CMS-authored block.

## 2. Which components consume these unions

**Renderer / dispatch layer**
- `src/app/_components/Blocks/index.tsx` — maps `blockType` → component
  (`cta`/`content`/`mediaBlock`/`archive`/`relatedProducts`), typed as
  `(Page['layout'][0] | RelatedProductsProps)[]`. Notably imports from
  `payload-types.js` (not `.ts`) — a pre-existing quirk, not part of this
  plan, but worth knowing before any file-level refactor here.
- `src/app/_components/Hero/index.tsx` — maps `hero.type` → hero component,
  typed directly as `React.FC<Page['hero']>`.

**Block components** (each types its props as `Extract<Page['layout'][0], { blockType: '...' }>`)
- `src/app/_blocks/CallToAction/index.tsx`
- `src/app/_blocks/Content/index.tsx`
- `src/app/_blocks/MediaBlock/index.tsx`
- `src/app/_blocks/ArchiveBlock/types.ts` (+ `ArchiveBlock/index.tsx`, which imports the type)
- `src/app/_blocks/RelatedProducts/index.tsx` — its own `RelatedProductsProps`, not a `Page['layout']` extract, but rendered by the same `Blocks` dispatcher

**Hero components** (each typed as `Page['hero']` or a subset of it)
- `src/app/_heros/HighImpact/index.tsx`
- `src/app/_heros/MediumImpact/index.tsx`
- `src/app/_heros/LowImpact/index.tsx`
- `src/app/_heros/CustomHero/index.tsx`
- `src/app/_heros/Product/index.tsx` — a fifth, product-specific hero that does **not** consume `Page['hero']` (derives its display fields from `Product.meta`/`categories` directly); included here only because it's rendered by the same dispatch pattern

**Callers that pass `layout`/`hero` down**
- `src/app/(pages)/[slug]/page.tsx` — CMS page route; passes `page.hero` to `Hero`, `page.layout` to `Blocks`
- `src/app/(pages)/cart/page.tsx`, `src/app/(pages)/products/page.tsx` — same pattern for their respective seed/fetched `Page`
- `src/app/(pages)/products/[slug]/page.tsx` — passes `product.layout` to `Blocks` (paired with `RelatedProductsProps`), `product` to `ProductHero`
- `src/app/_components/PaywallBlocks/index.tsx` — client component; fetches paywalled `Page['layout']` after auth and feeds it back into `Blocks`

**Shared link union** (`hero.links[].link` / `cta.links[].link` / `content.columns[].link`)
- `src/app/_components/Header/Nav/index.tsx`, `src/app/_components/Header/HeaderComponent/index.tsx`, `src/app/_components/Header/index.tsx` — `Header.navItems` reuses the same link shape
- `src/app/_components/Footer/FooterComponent/index.tsx`, `src/app/_components/Footer/index.tsx` — `Footer.navItems`, same shape (this file's *media*-only usage was narrowed in this phase — see the 13H report; its `navItems`/`Footer` typing is unrelated and still CMS-union-shaped)
- `src/app/_components/Link` (`CMSLink`) — the actual `href`-resolution logic for the union, referenced by every block/hero above

**Native-side mirror (already exists, not native-typed)**
- `src/lib/domain/types.ts` — `Page.layout: unknown[]`, `Page.hero: unknown`, `Product.layout: unknown[]` are deliberately untyped ("owned by the CMS/render layer, not the domain layer" per its own comments)
- `src/lib/repositories/adapters/layoutRelationsAdapter.ts` — resolves relational fields (`media`, `link.reference`, `archive.populatedDocs`) inside the raw block/hero tree using untyped `RawBlock = Record<string, any>`, then hands the result back as `unknown`/`unknown[]`
- `src/lib/repositories/adapters/pageStorefrontAdapter.ts` — the seam where the untyped native result gets forced into shape: `layout: resolved.layout as PayloadPage['layout']` and `hero: (resolved.hero ?? {...}) as PayloadPage['hero']` — **both are unchecked casts today**, not real structural guarantees

## 3. What a native equivalent would need to include

1. **A discriminated union type**, e.g. `NativeLayoutBlock`, replacing
   `layout: unknown[]` in `src/lib/domain/types.ts`, mirroring the four
   `blockType` members above but built from the *native* domain vocabulary
   (native `Media`, a native link/reference shape) instead of re-importing
   `payload-types.ts` shapes — mirroring how `domain/types.ts`'s `Media`
   already deliberately duplicates rather than imports `payload-types.ts`'s
   `Media`.
2. **A native hero type**, e.g. `NativeHero`, same treatment for `hero`.
3. **A native link/reference type**, since it's shared by three block kinds
   plus `Header.navItems`/`Footer.navItems` — worth extracting once rather
   than four times.
4. **Real validation/parsing at the repository boundary**, replacing
   `layoutRelationsAdapter.ts`'s untyped `RawBlock` walk — ideally a
   runtime shape check (or at least a narrowing helper per `blockType`)
   so a malformed Mongo document fails loudly in `fetchPageNative.ts`/
   `fetchProductNative.ts` instead of silently satisfying an `as` cast.
5. **A mapping layer from `NativeLayoutBlock`/`NativeHero` back to
   `payload-types.ts`'s `Page['layout']`/`Page['hero']`**, so
   `pageStorefrontAdapter.ts`/`productStorefrontAdapter.ts` can keep
   producing the exact shape `Blocks`/`Hero` and every block/hero
   component already expects — this is what lets the migration proceed
   file-by-file on the render side rather than as one atomic cutover (see
   Sequencing below).
6. **Resolution of what's currently left unresolved** — the
   `layoutRelationsAdapter.ts` header notes `archive.categories` and
   `archive.selectedDocs` are intentionally *not* relation-resolved today
   because no current component reads them. A native `archive` block type
   needs to decide whether to keep that scope-limited or resolve them for
   completeness.

## 4. Which files would need coordinated changes

Coordinated (must land together, since they share one union type):
- `src/lib/domain/types.ts` (`Page`, `Product` — the new native types)
- `src/lib/repositories/adapters/layoutRelationsAdapter.ts` (real parsing/validation instead of `RawBlock`)
- `src/lib/repositories/adapters/pageStorefrontAdapter.ts`, `productStorefrontAdapter.ts` (the cast → real mapping)
- Every block component's `Props` type (`CallToAction`, `Content`, `MediaBlock`, `ArchiveBlock/types.ts`) — only if/when they're repointed at the native type instead of `Extract<Page['layout'][0], ...>`
- Every hero component (`HighImpact`, `MediumImpact`, `LowImpact`, `CustomHero`) and `Hero/index.tsx`'s dispatcher — same conditional note
- `src/app/_components/Blocks/index.tsx` (dispatcher's prop type)
- The link/reference union, if extracted: `Header/Nav`, `HeaderComponent`, `Header/index.tsx`, `Footer/FooterComponent`, `Footer/index.tsx`, `_components/Link` (`CMSLink`)

Can stay on the Payload-shaped union indefinitely (lower priority, or
permanently out of scope for this migration):
- `src/app/_blocks/RelatedProducts/index.tsx` — already its own type, not `Page['layout']`-derived
- `src/app/_heros/Product/index.tsx` — doesn't consume `Page['hero']`
- `src/app/(pages)/[slug]/page.tsx`, `cart/page.tsx`, `products/page.tsx`, `products/[slug]/page.tsx`, `PaywallBlocks` — these just pass the value through; they only need to change if/when their *source* (`fetchPageNative`/`fetchDoc`) starts returning the native-typed shape instead of the mapped Payload shape

## 5. Risks and suggested sequencing

**Risks**
- **Silent shape drift.** `layoutRelationsAdapter.ts`'s current `as`
  casts mean a native document that's missing a field a block component
  expects fails at *render* time (or worse, renders wrong), not at the
  repository boundary. Introducing real types will surface latent bugs
  that exist today — expect this phase to find real, pre-existing data
  issues, not just add type coverage.
- **Two more block-authoring shapes to keep in sync going forward.**
  Once a native block type exists alongside `payload-types.ts`'s
  generated one, every future CMS field addition (new block, new field on
  an existing block) has to be hand-mirrored in the native type — there's
  no code-generation step for the native side the way `payload generate:types`
  provides for Payload's. This is an ongoing maintenance cost, not a
  one-time migration cost.
- **`archive` is the highest-risk block.** It has the most fields, the
  only block-level relation resolution that reaches into another
  collection (`Product`, via `populatedDocs`), and (per §3.6) known gaps
  in what's currently resolved at all.
- **The link/reference union is shared across three block kinds plus both
  nav globals.** A mistake in its native shape has the widest blast
  radius of anything in this plan — recommend building and proving it in
  isolation (unit tests against `layoutRelationsAdapter.ts`'s
  `resolveLink`/`resolveLinkGroup` today) before wiring it into any block.
- **`Blocks`/`Hero`'s dispatcher pattern (`block.blockType in blockComponents`)
  relies on TypeScript's control-flow narrowing through the discriminated
  union.** A hand-written native union needs to preserve the exact
  discriminant shape (`blockType: 'cta'` as a literal, not `string`) or
  this narrowing silently degrades to `any`/`unknown` at the call site
  without a visible error, given `strict: false` in `tsconfig.json`.
- **This migration is independent of, but adjacent to, the media
  view-model work.** `mediaBlock.media`, `hero.media`, and every
  `link.icon` are still full `Media`/`string | Media` today because they
  render through the `Media` display component — nothing in Phase 13H's
  `StorefrontMediaItem` addition applies here, and a native layout/hero
  type still needs the *full* native `Media` shape for these fields, not
  the narrow view-model.

**Suggested sequencing**
1. Land the native `NativeLayoutBlock`/`NativeHero`/link-reference types
   in `domain/types.ts` with no consumers yet (pure addition, zero risk).
2. Replace `layoutRelationsAdapter.ts`'s `RawBlock` walk with real
   parsing against the new types, still producing the same
   Payload-shaped output `pageStorefrontAdapter.ts` expects (i.e.,
   validate internally, keep the external contract identical) — this is
   the step that surfaces any pre-existing data issues, in isolation from
   any render-layer change.
3. Migrate the link/reference union first, in isolation (lowest-fanout,
   proven independently — see Risks) — `CMSLink` plus the two nav globals.
4. Migrate one block type end-to-end (recommend `mediaBlock` — smallest
   surface, and its `media` field can reuse the *full* native `Media`
   type already defined in `domain/types.ts`, no new type needed there).
5. Migrate `cta`, then `content`.
6. Migrate `hero` (reuses the link union and `mediaBlock`'s media pattern
   from steps 3–4).
7. Migrate `archive` last (highest risk — see above), deciding at this
   point whether to close the `categories`/`selectedDocs` resolution gap.
8. Only after all seven are proven: consider whether `Blocks`/`Hero`'s
   dispatcher and `pageStorefrontAdapter.ts`/`productStorefrontAdapter.ts`
   can drop the Payload-shaped intermediate representation entirely, or
   whether keeping it as a stable render-layer contract (decoupled from
   whichever CMS/repository sits behind it) is actually the better
   permanent architecture — this codebase's adapters already lean toward
   "keep a stable Payload-shaped contract, swap what produces it," and
   nothing in this plan requires abandoning that pattern.

## 6. Estimated scope

Rough sizing, each step assuming its own validation pass
(lint/typecheck/test) before moving to the next — **not** a time
estimate, since that depends entirely on how much latent data drift
step 2 surfaces:

| Step | New/changed files | Relative size |
|---|---|---|
| 1. Native types (no consumers) | ~1 file changed (`domain/types.ts`) | Small |
| 2. `layoutRelationsAdapter.ts` real parsing | 1 file rewritten, its existing unit tests extended | Medium |
| 3. Link/reference union | `CMSLink`, `Header/Nav`, `HeaderComponent`, `Header/index.tsx`, `Footer/FooterComponent`, `Footer/index.tsx` (~6 files) | Medium |
| 4. `mediaBlock` | `MediaBlock/index.tsx`, `Blocks/index.tsx` (partial) | Small |
| 5. `cta` + `content` | `CallToAction/index.tsx`, `Content/index.tsx`, `Blocks/index.tsx` (partial) | Medium |
| 6. `hero` | `Hero/index.tsx` + 4 hero variants | Medium |
| 7. `archive` | `ArchiveBlock/types.ts`, `ArchiveBlock/index.tsx`, `layoutRelationsAdapter.ts` (archive-specific resolution) | Large — highest uncertainty |
| 8. Dispatcher/adapter cleanup (optional) | `Blocks/index.tsx`, `Hero/index.tsx`, `pageStorefrontAdapter.ts`, `productStorefrontAdapter.ts` | Medium, and optional |

Total: roughly on the same order of magnitude as Phases 13A–13G
combined (the whole `payload-types.ts` import-reduction effort to date),
concentrated more heavily on step 2 (validation) and step 7 (`archive`)
than on the mechanical type-swapping in the middle steps. No part of
this should be attempted as a single phase — each numbered step above is
sized to be its own phase, gated on the previous one's lint/typecheck/test
baseline staying green, consistent with how Phases 0–13G have proceeded.
