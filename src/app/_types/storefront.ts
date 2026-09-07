// src/app/_types/storefront.ts
//
// PHASE 13F-B — narrow, dedicated "view model" types for leaf UI
// components that only ever read a handful of scalar fields off a
// document, never a populated relation's full shape or `Media.sizes`.
// See PHASE13F-B_REPORT.md for the audit that established which
// components qualify for this and which don't.
//
// These are intentionally NEITHER re-exports of `payload-types.ts`'s
// generated interfaces NOR the native `domain/types.ts` shapes (those
// have no `priceJSON`/CMS-`slug`-shaped fields — the storefront still
// runs on Payload-shaped data by default; see the `*StorefrontAdapter.ts`
// files' header comments for why that's the deliberate design). They
// are structural SUBSETS: any real `payload-types.ts` object (`Product`,
// `Category`, `Page`, `Media`), OR any object a `*StorefrontAdapter.ts`
// produces for the native-repository path (built specifically to match
// payload-types.ts's shape), satisfies these interfaces without any
// change to the call sites that construct/fetch them — that's what
// makes narrowing a component's prop type to one of these "safe" on its
// own, with no coordinated changes anywhere else.
//
// Extend this file (rather than reaching back for payload-types.ts)
// when a new leaf component needs another read-only, non-relational
// field — that keeps this safe/narrow migration path open for future
// phases instead of undoing it.
//
// PHASE 13K — `StorefrontCMSLink`/`StorefrontNavItem`/`StorefrontHeader`/
// `StorefrontFooter` below are *derived* from `NativeCMSLink`
// (src/lib/domain/types.ts) with `Omit<...>` rather than hand-duplicated
// field-for-field like the interfaces above — see each type's doc comment
// for why the specific fields are overridden. This is the "compatible
// storefront view model" half of the Phase 13K objective (migrate the
// shared Header/Footer/CMSLink nav consumers onto `NativeCMSLink` "where
// safe"): a literal `reference?: { relationTo: 'pages'; value: string |
// Page }` (domain `Page`, which requires `status`/`layout`/`hero`/etc.)
// is NOT safe here, because every real caller — both the default
// Payload/GraphQL path (payload-types.ts's `Header`/`Footer`) and the
// flag-gated native path (globalsStorefrontAdapter.ts's
// `toStorefrontHeader`/`toStorefrontFooter`) — only ever populates
// `reference.value` with `{ slug }`, never a full `Page`. Same reasoning
// applies to `icon` (never a full `Media`, just `{ url }`) and `label`
// (Payload's generated type marks it required; the real GraphQL/native
// data doesn't always populate it, matching the pre-13K `CMSLinkType`).

import type { NativeCMSLink, NativeHeroType, NativeLayoutBlock } from '../../lib/domain/types'

/** The subset of `NativeCMSLink` that `Header`/`Footer` nav items and
 * `CMSLink` actually exchange — `type`/`newTab`/`url`/`appearance` are
 * kept as-is from `NativeCMSLink`, while `reference`/`icon`/`label` are
 * narrowed to the `{ slug }`/`{ url }`/optional shapes every real caller
 * (Payload GraphQL, and the native `globalsStorefrontAdapter.ts` path)
 * actually produces — see the file-level comment above. Every real
 * `payload-types.ts` `Header['navItems'][number]['link']` /
 * `Footer['navItems'][number]['link']`, and everything
 * `globalsStorefrontAdapter.ts`'s `toStorefrontLink` produces, satisfies
 * this unchanged. */
export type StorefrontCMSLink = Omit<NativeCMSLink, 'reference' | 'icon' | 'label'> & {
  reference?: {
    relationTo: 'pages'
    value: string | StorefrontLinkablePage
  }
  /** Kept as a `string | StorefrontMediaItem` union (matching
   * `payload-types.ts`'s `string | Media` and `NativeCMSLink`'s
   * `string | Media`) rather than narrowed to just `StorefrontMediaItem`,
   * because an *unresolved* relation (before Payload/the native adapter
   * populates it) really can be the bare id string — narrowing this away
   * would make `StorefrontFooter`/`StorefrontHeader` unsafe to assign the
   * real `fetchHeader()`/`fetchFooter()` return value to (see
   * ../_components/Footer/FooterComponent/index.tsx, the one reader of
   * this field, for how it's narrowed further at the point of use). */
  icon?: string | StorefrontMediaItem
  label?: string
}

/** Mirrors the `{ link, id? }` wrapper Payload puts around every nav item
 * (see `NativeLinkGroupItem` in domain/types.ts, which this deliberately
 * parallels with the narrower `StorefrontCMSLink` in place of
 * `NativeCMSLink`). */
export interface StorefrontNavItem {
  id?: string
  link: StorefrontCMSLink
}

/** The subset of `payload-types.ts`'s `Header` that `HeaderComponent`/
 * `HeaderNav` actually read. */
export interface StorefrontHeader {
  navItems?: StorefrontNavItem[]
}

/** The subset of `payload-types.ts`'s `Footer` that `FooterComponent`
 * actually reads: `copyright` plus the same nav items as `StorefrontHeader`
 * above (used here for the social-link icons, not page navigation). */
export interface StorefrontFooter {
  copyright?: string | null
  navItems?: StorefrontNavItem[]
}

// ---------------------------------------------------------------------------
// PHASE 13L — CMS block/hero view models
// ---------------------------------------------------------------------------
//
// The types below extend the Phase 13K `StorefrontCMSLink` chain to the
// CMS block/hero components that consume `links`/`link` props
// (`CallToActionBlock`, `ContentBlock`, `HighImpactHero`, `MediumImpactHero`,
// `CustomHero`, `LowImpactHero`). Same derivation pattern as Phase 13K:
// each is a structural subset of both the real `payload-types.ts` `Page`
// shape (`Page['layout'][number]` for the block variants, `Page['hero']`
// for the hero variants) AND the matching native domain type
// (`NativeCallToActionBlock`/`NativeContentBlock`/`NativeHero` in
// `src/lib/domain/types.ts`), with `NativeCMSLink` swapped for
// `StorefrontCMSLink` throughout (same reasoning as `StorefrontNavItem`
// above — every real caller only ever populates `reference.value` with
// `{ slug }` and `icon` with `{ url }`, never a full domain `Page`/`Media`).
//
// `media` is deliberately NOT included in any hero type here.
// `HighImpactHero`/`MediumImpactHero` pass their hero's `media` field
// straight through to the `<Media resource={...} />` display component,
// which requires the FULL `payload-types.ts` `Media` shape (specifically
// `.sizes`, for its responsive `srcset` logic — see `Media/types.ts`,
// which Phase 13L does not touch, same as every prior phase). Narrowing
// `media` the way `icon`/`reference.value` are narrowed elsewhere would
// make it unsafe to pass to `<Media />`. Those two hero components keep
// `media` typed directly against `payload-types.ts`'s `Media` in their own
// local prop type instead of through a shared view model here — see
// `src/app/_heros/HighImpact/index.tsx` / `MediumImpact/index.tsx`.
// `CustomHero` never passes `media` to the `Media` component (it only
// reads `.filename` for a CSS `background-image` URL), so it narrows
// `media` to `string | StorefrontMediaItem` locally instead.

/** The untyped Lexical/Slate-style rich text array every CMS block/hero's
 * `richText` field carries. Mirrors `NativeRichTextNode[]`
 * (`src/lib/domain/types.ts`) and is structurally identical to
 * `payload-types.ts`'s inline `{ [k: string]: unknown }[]` richText shape.
 * Every component that reads this only ever forwards it to
 * `<RichText content={...} />` (itself typed `content: any`), so this just
 * gives the array a name instead of repeating the anonymous type inline. */
export type StorefrontRichText = Record<string, unknown>[]

/** Mirrors `NativeLinkGroupItem` (`src/lib/domain/types.ts`) — identical
 * shape to `StorefrontNavItem` above (`{ id?, link: StorefrontCMSLink }`),
 * aliased separately so `hero.links` / `cta.links` call sites read as "a
 * list of CMS links" rather than "nav items", matching Payload's own field
 * naming for these (`hero.links`, `cta.links`) vs. `Header`/`Footer`'s
 * `navItems`. */
export type StorefrontLinkGroupItem = StorefrontNavItem

/** The subset of `payload-types.ts`'s `Page['layout'][number]` (the `cta`
 * block variant) that `CallToActionBlock` actually reads. Mirrors
 * `NativeCallToActionBlock` (`src/lib/domain/types.ts`) with `links`
 * narrowed to `StorefrontLinkGroupItem[]` in place of
 * `NativeLinkGroupItem[]`. Every real Payload `cta` block, and everything
 * a future native `cta` block producer would build to match
 * `NativeCallToActionBlock`, satisfies this unchanged. */
export interface StorefrontCallToActionBlock {
  invertBackground?: boolean
  richText: StorefrontRichText
  links?: StorefrontLinkGroupItem[]
  id?: string
  blockName?: string
  blockType?: 'cta'
}

/** The subset of `payload-types.ts`'s `Page['layout'][number]['columns'][number]`
 * (the `content` block's column shape) that `ContentBlock` actually reads.
 * Mirrors `NativeContentColumn` (`src/lib/domain/types.ts`), `link`
 * narrowed to `StorefrontCMSLink` in place of `NativeCMSLink`. */
export interface StorefrontContentColumn {
  size?: 'oneThird' | 'half' | 'twoThirds' | 'full'
  richText: StorefrontRichText
  enableLink?: boolean
  link?: StorefrontCMSLink
  id?: string
}

/** The subset of `payload-types.ts`'s `Page['layout'][number]` (the
 * `content` block variant) that `ContentBlock` actually reads. Mirrors
 * `NativeContentBlock` (`src/lib/domain/types.ts`) with `columns` narrowed
 * to `StorefrontContentColumn[]`. */
export interface StorefrontContentBlock {
  invertBackground?: boolean
  columns?: StorefrontContentColumn[]
  id?: string
  blockName?: string
  blockType?: 'content'
}

/** The subset of `payload-types.ts`'s `Page['hero']` that `LowImpactHero`
 * reads (`richText` only — `LowImpactHero` never reads `links` or `media`,
 * unlike the other three hero variants). */
export interface StorefrontLowImpactHero {
  richText: StorefrontRichText
}

/** The `richText`/`links` subset of `payload-types.ts`'s `Page['hero']`
 * shared by `HighImpactHero`/`MediumImpactHero`/`CustomHero` — mirrors
 * `NativeHero` (`src/lib/domain/types.ts`) minus `media` (see the
 * file-level comment above for why `media` is deliberately excluded here
 * and typed locally by each of those three components instead). */
export interface StorefrontHeroLinksContent {
  richText: StorefrontRichText
  links?: StorefrontLinkGroupItem[]
}

/** Anything with a `.url` — matches both `payload-types.ts`'s `Media`
 * and the bare media-id-string state a `string | Media` relation field
 * can be in before population. Deliberately does NOT include `.sizes`
 * (needed for responsive `srcset`) — nothing typed with this should be
 * passed to the `Media` display component; see `CategoryCard`, which
 * only ever reads `.url` for a CSS `background-image`. */
export type StorefrontMediaRef = string | { url?: string | null } | null | undefined

/** PHASE 13H — a structural subset of `payload-types.ts`'s `Media` for
 * components that read a handful of plain scalar fields off an
 * already-populated media object — `.url`/`.width`/`.height`/`.alt`/
 * `.filename`/`.mimeType` — and do NOT pass the object to the `Media`
 * display component (which needs the full `Media` shape for its
 * responsive-image logic). Every real `payload-types.ts` `Media` object,
 * and everything `mediaStorefrontAdapter.ts`'s `toStorefrontMedia`
 * produces for the native-repository path, satisfies this unchanged.
 *
 * Unlike `StorefrontMediaRef` (just `.url`, for CSS backgrounds/plain
 * `<img>`/`next/image` `src`), reach for this when a component also
 * needs `.width`/`.height`/`.alt`/etc. off the same populated object —
 * still never `.sizes`. See `FooterComponent`'s social-link icons for
 * the first caller.
 *
 * PHASE 13N — this is exactly the "simple media fields" view model that
 * phase's audit set out to add (`url?`/`width?`/`height?`/`alt?`/
 * `filename?`/`mimeType?`, no `.sizes`), so it is reused here rather than
 * duplicated under a new name. That audit also traced every line of
 * `src/app/_components/Media/index.tsx`, `Media/Image/index.tsx`, and
 * `Media/Video/index.tsx` and confirmed the display component's
 * rendering logic only ever reads `resource.mimeType` (video/image
 * branch), `resource.width`/`.height`/`.filename`/`.alt` (`Image`), and
 * `resource.filename` (`Video`) — i.e. a subset of the six fields above,
 * and `resource.url` is never read at all (`Image` builds its own
 * `/media/${filename}` URL). It also confirmed `payload-types.ts`'s
 * generated `Media` interface has no `.sizes` field to begin with — the
 * "needs `Media.sizes` for responsive variants" reasoning in earlier
 * phases' comments (13H/13L/13M) describes a caution about a case that
 * does not exist in this codebase's generated types, not an actual field
 * this component reads.
 *
 * This means `Media`'s `Props.resource` (`src/app/_components/Media/
 * types.ts`) could, in principle, be safely narrowed from `string |
 * payload-types.ts Media` to `string | StorefrontMediaItem` without
 * changing what it renders. Phase 13N deliberately does NOT make that
 * change — see that phase's report ("Remaining Blockers" /
 * "Recommended Next Phase") for why it's left as a single, explicit,
 * separately-tested follow-up rather than folded into this audit. */
export interface StorefrontMediaItem {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  filename?: string | null
  mimeType?: string | null
}

/** The subset of `payload-types.ts`'s `Product` that `Price` (and its
 * exported `priceFromJSON` helper) actually reads — just the
 * pre-serialized Stripe price blob. */
export interface StorefrontPriceableProduct {
  priceJSON?: string | null
}

/** The subset of `payload-types.ts`'s `Page` that `CMSLink` actually
 * reads when resolving an internal `reference` link's `href`. */
export interface StorefrontLinkablePage {
  slug?: string | null
}

// ---------------------------------------------------------------------------
// PHASE 13P — Cart product view model
// ---------------------------------------------------------------------------
//
// The Cart provider/reducer (`useCart()`'s `cart`/`addItemToCart`/
// `deleteItemFromCart`/`isProductInCart`) and the two Cart-coupled leaf
// components that call it (`AddToCartButton`, `RemoveFromCartButton`) never
// read a populated `Product` relation, a CMS `layout`/`paywall` block union,
// or `categories` — they only ever match cart lines by `.id`, and render a
// label/link/thumbnail for the cart row. `StorefrontCartProduct` below is
// that subset.

/** The subset of `payload-types.ts`'s `Product` that Cart-coupled code
 * actually reads: `id` for cart-line identity/dedup matching (every
 * `isProductInCart`/`deleteItemFromCart`/reducer `DELETE_ITEM` comparison
 * is `product.id === incomingProduct.id`, nothing deeper), `title`/`slug`
 * for the cart row's label and "view product" link, and `meta.image` for
 * the cart row's thumbnail. Extends `StorefrontPriceableProduct` for
 * `priceJSON`, since the same cart row also renders a `<Price product=
 * {product} />` and there's already a name for that field.
 *
 * `meta.image` is narrowed to `StorefrontMediaRef` (just `.url`) rather
 * than the full `payload-types.ts` `Media` — unlike `HighImpactHero`/
 * `MediumImpactHero`'s `media` field (see the file-level `PHASE 13L`
 * comment above), the one place this flows to a `<Media resource={...}
 * />` call (`src/app/(pages)/cart/CartItem/index.tsx`) is itself a plain,
 * untyped function component with no declared prop types (consistent
 * with how it already receives `product`/`title`/`qty`/`addItemToCart`),
 * so nothing here is ever type-checked against `Media/types.ts`'s
 * `Props.resource: string | payload-types.ts Media` requirement the way
 * `HighImpactHero`/`MediumImpactHero` are. Should that component ever
 * gain explicit prop types, this field would need to move to the full
 * `Media` type at that point, the same way the hero components' `media`
 * field does.
 *
 * Every real `payload-types.ts` `Product` satisfies this unchanged. */
export interface StorefrontCartProduct extends StorefrontPriceableProduct {
  id: string
  title: string
  slug?: string | null
  meta?: {
    image?: StorefrontMediaRef
  } | null
}

/** The subset of `payload-types.ts`'s `Settings` global that `CartPage`/
 * `CheckoutPage`/`LogoutPage` actually read: the `productsPage`
 * relation, and only ever for its `.slug` (a "continue shopping" link) —
 * never any other field on `Settings` or the full populated `Page`. */
export interface StorefrontSettingsLike {
  productsPage?: string | StorefrontLinkablePage | null
}

/** The subset of `payload-types.ts`'s `Category` that `CategoryCard`/
 * `Categories`/`Filters` actually read: id/title for display and
 * filtering, plus an optional media reference for CategoryCard's CSS
 * background image (`.url` only — see `StorefrontMediaRef`). */
export interface StorefrontCategory {
  id: string
  title?: string | null
  media?: StorefrontMediaRef
}

/** PHASE 13G — the subset of `payload-types.ts`'s `Order` that the
 * order-*list* pages (`/orders`, `/account/orders`) actually read: a
 * summary row of id/total/createdAt. Deliberately does NOT include
 * `.items`, `.stripePaymentIntentID`, or any populated `Product`/`User`
 * relation — the order-*detail* pages (`/orders/[id]`,
 * `/account/orders/[id]`) need those (they render a populated
 * `Product`'s `meta.image` through the `Media` display component,
 * which needs `.sizes`), so they intentionally stay on the full
 * `Order` type and were left unchanged. */
export interface StorefrontOrderSummary {
  id: string
  total: number
  createdAt: string
}

/** PHASE 13M — the subset of `payload-types.ts`'s `Order` that
 * `CheckoutForm` actually reads after creating an order via Payload's
 * `/api/orders` REST endpoint: just the newly-created order's `.id`, to
 * build the `/order-confirmation?order_id=...` redirect. Deliberately
 * does NOT include `.items`, `.total`, `.stripePaymentIntentID`, or any
 * other field — none of them are read here. Every real `Order` (and the
 * native `/api/orders/native` route's `{ orderId }` response, which this
 * type does not even apply to — see CheckoutForm's own branch) satisfies
 * this unchanged. */
export interface StorefrontOrderReference {
  id: string
}

/** PHASE 13G — the subset of `payload-types.ts`'s `Page`/`Product` that
 * `generateMeta` actually reads: `.slug` and a few `.meta` fields for
 * an SEO/Open-Graph tag, including the `.meta.image` media relation —
 * read only for its `.url` (see `StorefrontMediaRef`), never `.sizes`.
 * Every real `Page`/`Product` (and the `staticHome`/`staticCart` seed
 * fallbacks, which are plain `Page`-shaped objects) satisfies this
 * unchanged. */
export interface StorefrontMetaDoc {
  slug?: string | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: StorefrontMediaRef
  } | null
}

// ---------------------------------------------------------------------------
// PHASE 13Q — dispatcher-level CMS layout/hero view models
// ---------------------------------------------------------------------------
//
// The two types below are deliberately much smaller than the Phase 13L
// per-block/hero-variant view models above (`StorefrontCallToActionBlock`,
// `StorefrontContentBlock`, `StorefrontHeroLinksContent`, etc). Those exist
// for the individual `_blocks/*`/`_heros/*` *rendering* components, each of
// which reads a different, fuller set of fields for its own variant.
// `StorefrontLayoutBlock`/`StorefrontHero` below exist for the *dispatcher*
// layer one level up — `src/app/_components/Blocks/index.tsx` and
// `src/app/_components/Hero/index.tsx` — which never reads any
// variant-specific field itself. `Blocks` only ever reads `blockType` (to
// pick a renderer / compute background-inversion padding) and `blockName`
// (for a DOM id); `Hero` only ever reads `type` (to pick a renderer or
// render nothing for `'none'`). Everything else that flows through each
// dispatcher is opaque to the dispatcher itself and is only actually
// consumed once it reaches the chosen `_blocks/*`/`_heros/*` component,
// which keeps its own existing (unchanged) prop type for that purpose — see
// `src/app/_components/Blocks/index.tsx` and `src/app/_components/Hero/
// index.tsx` for the documented, minimal boundary casts that bridge the
// dispatcher's narrow view model back to each chosen component's fuller
// prop type at the actual render call.
//
// Both types are structural subsets of the real `payload-types.ts`
// `Page['layout'][number]` / `Page['hero']` shapes AND of `NativeLayoutBlock`
// / a `NativeHero`-shaped object (`src/lib/domain/types.ts`) — every real
// Payload-sourced or native-sourced page/product layout array and hero
// object satisfies them unchanged, which is what makes narrowing the two
// dispatchers' prop types to these "safe" on its own, with no coordinated
// changes to callers. See tests/storefrontCmsDispatcher.test.ts for the
// regression tests establishing this.

/** The `blockType` literal union of every real CMS-authored layout block —
 * pulled directly off `NativeLayoutBlock`'s discriminant (`src/lib/domain/
 * types.ts`) via indexed access rather than re-typed by hand, so it can't
 * silently drift from that file's four block variants. Does NOT include
 * `'relatedProducts'` — same as `NativeLayoutBlock` itself, that block is
 * synthesized by `RelatedProducts`/`ProductHero` at render time, never a
 * real Payload-authored block (see `NativeLayoutBlock`'s own doc comment). */
export type StorefrontLayoutBlockType = NativeLayoutBlock['blockType']

/** The subset of every real CMS-authored layout block (`payload-types.ts`'s
 * `Page['layout'][number]`, and `NativeLayoutBlock` above) that the `Blocks`
 * dispatcher itself reads — see the file-level PHASE 13Q comment above for
 * why this is narrower than the Phase 13L per-block-type view models.
 *
 * `invertBackground` is modelled as optional on every block type here
 * (rather than only the three real block variants that actually declare
 * it — `cta`/`content`/`mediaBlock`; `archive` has no such field in either
 * `payload-types.ts` or `NativeArchiveBlock`) because `Blocks` only ever
 * probes it with `'invertBackground' in block`: a real `archive` block
 * still satisfies "optional and absent" here unchanged.
 *
 * This is deliberately NOT a discriminated union of the four full
 * per-block-type shapes — `Blocks` never narrows on `blockType` beyond a
 * plain object-key membership check (`blockType in blockComponents`), so
 * there is no control-flow-narrowing benefit to a full discriminated union
 * at this layer, and every field beyond the three below is read only by the
 * individual `_blocks/*` components once one is chosen, which Phase 13Q
 * leaves on their existing (some already Phase-13L-narrowed, some still
 * full `payload-types.ts`-derived) prop types unchanged. */
export interface StorefrontLayoutBlock {
  id?: string
  blockName?: string
  blockType: StorefrontLayoutBlockType
  invertBackground?: boolean
}

/** The subset of `payload-types.ts`'s `Page['hero']` (and a `NativeHero`-
 * shaped object, `src/lib/domain/types.ts`) that the `Hero` dispatcher
 * itself reads — see the file-level PHASE 13Q comment above. `type` is
 * typed as `NativeHeroType` (`'none' | 'highImpact' | 'mediumImpact' |
 * 'lowImpact' | 'customHero'`) rather than re-declared by hand, so it can't
 * drift from that file's hero-type union — identical literal set to
 * `payload-types.ts`'s inline `Page['hero']['type']`.
 *
 * Every other field (`richText`/`links`/`media`) is read only by whichever
 * `_heros/*` component `Hero` chooses to render, each of which keeps its own
 * existing, fuller prop type for that purpose (`StorefrontHeroLinksContent`
 * / `StorefrontLowImpactHero` from Phase 13L, plus each component's own
 * locally-typed `media` field) — Phase 13Q does not touch any of those. */
export interface StorefrontHero {
  type: NativeHeroType
}

// ---------------------------------------------------------------------------
// PHASE 13R — MediaBlock / ArchiveBlock view models
// ---------------------------------------------------------------------------
//
// These two follow the exact pattern Phase 13L used for
// `StorefrontCallToActionBlock`/`StorefrontContentBlock`: a structural
// subset of the real `payload-types.ts` `Page['layout'][number]` variant
// shape (`mediaBlock`/`archive`) AND of the matching native domain type
// (`NativeMediaLayoutBlock`/`NativeArchiveBlock`, `src/lib/domain/types.ts`),
// containing only the fields the leaf component itself reads. Every real
// Payload `mediaBlock`/`archive` block, and everything a future native
// block producer would build to match `NativeMediaLayoutBlock`/
// `NativeArchiveBlock`, satisfies these unchanged.

/** The subset of `payload-types.ts`'s `Page['layout'][number]` (the
 * `mediaBlock` variant) that `MediaBlock` itself reads —
 * `invertBackground`/`position`/`id`/`blockName`/`blockType` only. Mirrors
 * `NativeMediaLayoutBlock` minus `media`.
 *
 * `media` is deliberately NOT included here — same reasoning as
 * `StorefrontHeroLinksContent` excluding it above (see the file-level
 * PHASE 13L comment): `MediaBlock` passes `media` straight through to
 * `<Media resource={media} />` (`src/app/_components/Media/index.tsx`),
 * which requires the full `payload-types.ts` `Media` shape (see
 * `Media/types.ts`, which this phase does not touch). `MediaBlock` keeps
 * `media` typed directly against `payload-types.ts`'s `Media` in its own
 * local prop type instead — see `src/app/_blocks/MediaBlock/index.tsx`. */
export interface StorefrontMediaLayoutBlock {
  invertBackground?: boolean
  position?: 'default' | 'fullscreen'
  id?: string
  blockName?: string
  blockType?: 'mediaBlock'
}

/** A single entry in `archive.populatedDocs` — the only relation field
 * `ArchiveBlock`/`CollectionArchive` actually read (`selectedDocs` is never
 * destructured by `ArchiveBlock`, so it's omitted from
 * `StorefrontArchiveBlock` below entirely, unlike `NativeArchiveBlock`
 * which models it for domain-layer completeness).
 *
 * `value` is left as an opaque `string | Record<string, unknown>` in the
 * resolved case, rather than a duplicated "full Product" shape, because
 * neither `ArchiveBlock` nor `CollectionArchive` reads any field off a
 * resolved `value` today: `CollectionArchive` only ever forwards
 * `populatedDocs?.map(doc => doc.value)` into its initial result state,
 * immediately behind an `as []` cast that already discards whatever type
 * that expression has (see `src/app/_components/CollectionArchive/
 * index.tsx`) — never rendering a resolved `value` through `<Card />`
 * (which needs the full `payload-types.ts` `Product`; that only happens
 * for docs `CollectionArchive` gets back from its own API fetch, a runtime
 * `Product[]` unrelated to `populatedDocs`).
 *
 * `value` is typed `unknown` rather than `Record<string, unknown>` —
 * `payload-types.ts`'s generated `Product` interface has no index
 * signature, so (a TypeScript-specific quirk) it is not assignable to
 * `Record<string, unknown>` even though it's a plain object; `unknown`
 * accepts both the unresolved id string and any resolved object without
 * that pitfall. Every real Payload `populatedDocs` entry (`{ relationTo:
 * 'products'; value: string | Product }`) satisfies this unchanged. */
export interface StorefrontArchiveRelation {
  relationTo: 'products'
  value: unknown
}

/** The subset of `payload-types.ts`'s `Page['layout'][number]` (the
 * `archive` variant) that `ArchiveBlock` (and, through it,
 * `CollectionArchive` — see `src/app/_blocks/ArchiveBlock/types.ts`,
 * which re-exports this as `ArchiveBlockProps`) actually reads:
 * `introContent`/`populateBy`/`relationTo`/`categories`/`limit`/
 * `populatedDocs`/`populatedDocsTotal`, plus `id`/`blockName`/`blockType`
 * for parity with the other block view models. Mirrors
 * `NativeArchiveBlock` minus `selectedDocs` (see
 * `StorefrontArchiveRelation` above for why).
 *
 * `categories` is widened to `string[] | StorefrontCategory[]` rather than
 * `NativeArchiveBlock`'s `string[]`-only modelling — the native domain type
 * can get away with `string[]` only because nothing constructs a resolved
 * native `categories` today (see that type's own doc comment), but a real
 * `payload-types.ts` archive block's `categories` field can genuinely be
 * `Category[]` (populated), which a `string[]`-only type would reject.
 * `StorefrontCategory` (Phase 13F-B) already models exactly the fields
 * `CategoryCard`/`Categories`/`Filters` read off a populated `Category`,
 * so it's reused here rather than duplicated — every real `Category`
 * satisfies it unchanged, same as everywhere else it's used. */
export interface StorefrontArchiveBlock {
  introContent: StorefrontRichText
  populateBy?: 'collection' | 'selection'
  relationTo?: 'products'
  categories?: string[] | StorefrontCategory[]
  limit?: number
  populatedDocs?: StorefrontArchiveRelation[]
  populatedDocsTotal?: number
  id?: string
  blockName?: string
  blockType?: 'archive'
}

// ---------------------------------------------------------------------------
// PHASE 13U — ProductHero view model
// ---------------------------------------------------------------------------
//
// `ProductHero` (`src/app/_heros/Product/index.tsx`) previously took the
// full `payload-types.ts` `Product`. Tracing its actual reads: `title`
// (heading), `categories[].title` (category chip list), `meta.description`
// (description paragraph), `meta.image` (forwarded whole to `<Media
// resource={...} />`), and `product` itself forwarded whole to both
// `<Price product={product} />` (already `StorefrontPriceableProduct`,
// Phase 13F-B) and `<AddToCartButton product={product} />` (already
// `StorefrontCartProduct`, Phase 13P). `StorefrontProductHeroView` below
// extends `StorefrontCartProduct` (which already supplies
// `id`/`title`/`slug`/`priceJSON`/`meta.image` narrowed to
// `StorefrontMediaRef`) and adds the two fields ProductHero itself reads
// beyond that: `categories` and `meta.description`.
//
// `meta.image` here stays at `StorefrontCartProduct`'s existing narrow
// `StorefrontMediaRef` (just `.url`) — this type is declared with `Omit<
// StorefrontCartProduct, 'meta'> & { meta?: {...} }` rather than plain
// interface extension specifically so `meta` can add `description`
// alongside `image` without TypeScript's "weak type" check rejecting the
// override (redeclaring `meta` as `{ description?: ... }` alone, with no
// `image` key at all, has no properties in common with the base `{
// image?: ... }` and is flagged as a likely mistake). `ProductHero` itself
// widens `image` further still, to the full `payload-types.ts` `Media` —
// see below.
//
// `meta.image` is deliberately NOT widened to the full `payload-types.ts`
// `Media` here — same reasoning as `HighImpactHero`/`MediumImpactHero`/
// `MediaBlock`'s `media` field (see the file-level PHASE 13L comment
// above): `ProductHero` passes `meta.image` straight through to `<Media
// resource={...} />`, which requires the full generated `Media` shape.
// `ProductHero` keeps `meta.image` typed directly against
// `payload-types.ts`'s `Media` in its own local prop type instead (an
// `Omit<StorefrontProductHeroView, 'meta'> & { meta?: { image?: string |
// Media; ... } }` override, matching `HighImpactHero`'s pattern exactly)
// — see `src/app/_heros/Product/index.tsx`.
//
// `categories` mirrors `payload-types.ts`'s `Product['categories']`
// (`string[] | Category[]`) structurally as `(string |
// StorefrontProductCategoryRef)[]` (Phase 13S's category-ref view model,
// reused rather than duplicated) — `ProductHero` only ever reads
// `category.title` off a resolved entry (via a cast, since an unresolved
// relation can still be a bare id string), which `StorefrontProductCategoryRef`
// already models. Every real `payload-types.ts` `Product` satisfies
// `StorefrontProductHeroView` unchanged — see
// `tests/productHeroViewModel.test.ts`.
export type StorefrontProductHeroView = Omit<StorefrontCartProduct, 'meta'> & {
  categories?: (string | StorefrontProductCategoryRef)[]
  meta?: {
    image?: StorefrontMediaRef
    description?: string | null
  } | null
}

// ---------------------------------------------------------------------------
// PHASE 13S — adapter/fetch compatibility boundary view models
// ---------------------------------------------------------------------------
//
// `StorefrontPage`/`StorefrontProductDetail` below are the return shapes for
// `pageStorefrontAdapter.ts`'s `toStorefrontPage` and
// `productStorefrontAdapter.ts`'s `toStorefrontProduct` — the two functions
// that assemble a fully relation-resolved native Page/Product for the
// storefront's CMS page route (`src/app/(pages)/[slug]/page.tsx`) and
// Product detail route (`src/app/(pages)/products/[slug]/page.tsx`).
//
// Each field reuses whichever narrower Storefront view model already exists
// for that field's real downstream reader, instead of the matching
// `payload-types.ts` field type: `hero`/`layout` reuse the Phase 13Q
// dispatcher view models (`StorefrontHero`/`StorefrontLayoutBlock` — the
// same types `Hero`/`Blocks` themselves are already typed against), and
// `meta.image` reuses the Phase 13H media view model
// (`StorefrontMediaItem`).
//
// `categories`/`relatedProducts` are intentionally NOT narrowed as far as
// they could be:
//   - `categories` is `StorefrontProductCategoryRef[]` (id/title only) —
//     mirrors `ResolvedProductRelations.categories` exactly (see that
//     interface's own doc comment in `productStorefrontAdapter.ts` for why
//     only id/title are ever populated).
//   - `relatedProducts` is left `unknown[]` — same reasoning as
//     `StorefrontArchiveRelation.value` above: the one place it's actually
//     read (`RelatedProducts`/`Card`, `src/app/_blocks/RelatedProducts/
//     index.tsx`, `src/app/_components/Card/index.tsx`) still declares its
//     own props against the full `payload-types.ts` `Product` today — both
//     files are `_blocks/*`/`_components/*` leaf renderers this phase does
//     not touch (see this phase's own DO NOT list). Narrowing this field's
//     type here wouldn't reflect anything actually enforced yet, and
//     `unknown` avoids re-introducing a `payload-types.ts` import into this
//     dedicated non-Payload types file for a field this phase doesn't
//     change the consumer of.
//
// `toStorefrontPage`/`toStorefrontProduct` themselves now return exactly
// these two types, built with no per-field `payload-types.ts` cast anywhere
// inside `pageStorefrontAdapter.ts`/`productStorefrontAdapter.ts`. The one
// remaining conversion back to `payload-types.ts`'s `Page`/`Product` —
// still needed because `ProductHero`/`Card`/`RelatedProducts` (out of this
// phase's scope) declare their own props against the full generated types
// — now lives ONLY at the outermost `fetchPageNative.ts`/
// `fetchProductNative.ts` compatibility-boundary functions
// (`buildStorefrontPage`/`buildStorefrontProduct`), as a single, documented
// conversion, replacing the several per-field `as PayloadPage[...]`/
// `as PayloadProduct[...]` casts that used to live inside the adapter files
// themselves. See those two files' own PHASE 13S comments.

/** The subset of `payload-types.ts`'s `Page` that `toStorefrontPage`
 * assembles — mirrors the `PAGE` GraphQL query field-for-field (see
 * `pageStorefrontAdapter.ts`'s own file header): id, title, slug, _status,
 * hero, layout, meta, updatedAt, createdAt. `hero`/`layout` are typed
 * against the Phase 13Q dispatcher view models rather than
 * `payload-types.ts`'s `Page['hero']`/`Page['layout']` discriminated
 * unions — see the file-level PHASE 13S comment above. */
export interface StorefrontPage {
  id: string
  title: string
  slug?: string | null
  _status?: 'draft' | 'published' | null
  hero: StorefrontHero & Record<string, unknown>
  layout: StorefrontLayoutBlock[]
  meta?: {
    title?: string | null
    description?: string | null
    image?: StorefrontMediaItem
  } | null
  updatedAt: string
  createdAt: string
}

/** A single entry in `StorefrontProductDetail.categories` — mirrors
 * `ResolvedProductRelations.categories` (`productStorefrontAdapter.ts`):
 * only `id`/`title` are ever populated by the caller (see that interface's
 * own doc comment for why — `ProductHero` never reads more than
 * `category.title`). */
export interface StorefrontProductCategoryRef {
  id: string
  title?: string | null
}

/** The subset of `payload-types.ts`'s `Product` that `toStorefrontProduct`
 * assembles — mirrors the `PRODUCT` GraphQL query field-for-field (see
 * `productStorefrontAdapter.ts`'s own file header): id, title,
 * stripeProductID, categories, layout, priceJSON, enablePaywall,
 * relatedProducts, meta. `categories`/`layout` are typed against
 * `StorefrontProductCategoryRef`/`StorefrontLayoutBlock` rather than
 * `payload-types.ts`'s stricter unions — see the file-level PHASE 13S
 * comment above for `layout`, and `relatedProducts`' own doc comment above
 * for why it stays opaque. */
export interface StorefrontProductDetail {
  id: string
  title: string
  slug?: string | null
  _status?: 'draft' | 'published' | null
  stripeProductID?: string
  priceJSON?: string
  enablePaywall?: boolean
  categories: StorefrontProductCategoryRef[]
  layout: StorefrontLayoutBlock[]
  /** Left opaque — see the file-level PHASE 13S comment above. */
  relatedProducts: unknown[]
  meta?: {
    title?: string | null
    description?: string | null
    image?: StorefrontMediaItem
  } | null
  updatedAt: string
  createdAt: string
}
