// src/app/_types/storefront.ts
//
// The storefront's view models: the exact shapes UI components read.
//
// These are deliberately NOT the native domain types (`src/lib/domain/
// types.ts`). Domain types describe what is stored and what business rules
// operate on; the types here describe what a React component renders, after
// relations have been resolved by an adapter (`src/lib/repositories/
// adapters/*`). Keeping them apart is what stops rendering concerns from
// leaking into the domain layer and vice versa.
//
// Every type here is a structural subset of what its adapter produces, so a
// component's props stay as narrow as what it actually reads. Extend this
// file when a component needs another field; do not widen a component's
// props to a whole domain entity.
//
// Where a type mirrors a domain shape one-for-one it is derived from it
// (`Omit<NativeCMSLink, ...>`, `NativeLayoutBlock['blockType']`) rather than
// hand-copied, so the two cannot silently drift apart.

import type { NativeCMSLink, NativeHeroType, NativeLayoutBlock } from '../../lib/domain/types'

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** The fields the `Media` display component and its callers read off a
 * populated media document. Never includes responsive `sizes` — this
 * application stores a single rendition per media record. */
export interface StorefrontMediaItem {
  url?: string | null
  width?: number | null
  height?: number | null
  alt?: string | null
  filename?: string | null
  mimeType?: string | null
}

/** A media relation as a component may receive it: an unresolved id string,
 * a populated media object, or nothing at all. */
export type StorefrontMediaRef = string | StorefrontMediaItem | null | undefined

/** `StorefrontMediaItem` plus the rich-text `caption` that `HighImpactHero`
 * and `MediaBlock` render alongside the image itself. */
export interface StorefrontHeroMedia extends StorefrontMediaItem {
  caption?: StorefrontRichText
}

/** A fully populated media document, as `mediaStorefrontAdapter.ts` builds
 * it. Components should depend on `StorefrontMediaItem`/`StorefrontMediaRef`
 * instead; this exists for adapters and admin views that carry the whole
 * record. */
export interface StorefrontMedia extends StorefrontHeroMedia {
  id: string
  filesize?: number | null
  updatedAt: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Rich text and CMS links
// ---------------------------------------------------------------------------

/** The Slate-style rich text array every CMS block carries. Mirrors
 * `NativeRichTextNode[]`; components only ever forward it to `<RichText />`. */
export type StorefrontRichText = Record<string, unknown>[]

/** The subset of `NativeCMSLink` that nav items and `CMSLink` exchange.
 * `reference`/`icon`/`label` are narrowed to the shapes the adapters
 * actually populate: a referenced page is resolved to its slug only, and an
 * icon to its url only — never a whole page or media document. */
export type StorefrontCMSLink = Omit<NativeCMSLink, 'reference' | 'icon' | 'label'> & {
  reference?: {
    relationTo: 'pages'
    value: string | StorefrontLinkablePage
  }
  /** Stays a `string | StorefrontMediaItem` union because an unresolved
   * relation is a bare id string. `FooterComponent` narrows further at the
   * point of use. */
  icon?: string | StorefrontMediaItem
  label?: string
}

/** The `{ link, id? }` wrapper around every nav item. */
export interface StorefrontNavItem {
  id?: string
  link: StorefrontCMSLink
}

/** Same shape as `StorefrontNavItem`, aliased so `hero.links`/`cta.links`
 * call sites read as "a list of CMS links" rather than "nav items". */
export type StorefrontLinkGroupItem = StorefrontNavItem

/** What `HeaderComponent`/`HeaderNav` read off the Header global. */
export interface StorefrontHeader {
  navItems?: StorefrontNavItem[]
}

/** What `FooterComponent` reads off the Footer global: the copyright line
 * plus the social-icon nav items. */
export interface StorefrontFooter {
  copyright?: string | null
  navItems?: StorefrontNavItem[]
}

/** What `CartPage`/`CheckoutPage`/`LogoutPage` read off the Settings
 * global: the products page relation, and only for its slug. */
export interface StorefrontSettingsLike {
  productsPage?: string | StorefrontLinkablePage | null
}

/** What `CMSLink` reads off a referenced page when resolving an internal
 * link's href. */
export interface StorefrontLinkablePage {
  slug?: string | null
}

// ---------------------------------------------------------------------------
// CMS blocks and heroes
// ---------------------------------------------------------------------------

/** The `cta` layout block, as `CallToActionBlock` reads it. */
export interface StorefrontCallToActionBlock {
  invertBackground?: boolean
  richText: StorefrontRichText
  links?: StorefrontLinkGroupItem[]
  id?: string
  blockName?: string
  blockType?: 'cta'
}

/** One column of a `content` layout block. */
export interface StorefrontContentColumn {
  size?: 'oneThird' | 'half' | 'twoThirds' | 'full'
  richText: StorefrontRichText
  enableLink?: boolean
  link?: StorefrontCMSLink
  id?: string
}

/** The `content` layout block, as `ContentBlock` reads it. */
export interface StorefrontContentBlock {
  invertBackground?: boolean
  columns?: StorefrontContentColumn[]
  id?: string
  blockName?: string
  blockType?: 'content'
}

/** What `LowImpactHero` reads — rich text only, no links or media. */
export interface StorefrontLowImpactHero {
  richText: StorefrontRichText
}

/** The `richText`/`links` pair shared by `HighImpactHero`,
 * `MediumImpactHero` and `CustomHero`. Each of those types its own `media`
 * field locally, since they read different fields off it. */
export interface StorefrontHeroLinksContent {
  richText: StorefrontRichText
  links?: StorefrontLinkGroupItem[]
}

/** The `blockType` discriminant of every CMS-authored layout block, taken
 * from `NativeLayoutBlock` so it cannot drift from the domain layer. Does
 * not include `'relatedProducts'`, which is synthesized at render time. */
export type StorefrontLayoutBlockType = NativeLayoutBlock['blockType']

/** What the `Blocks` dispatcher itself reads. Everything else on a block is
 * opaque to the dispatcher and consumed only by the chosen renderer.
 * `invertBackground` is optional on every variant because `Blocks` only
 * probes it with an `in` check. */
export interface StorefrontLayoutBlock {
  id?: string
  blockName?: string
  blockType: StorefrontLayoutBlockType
  invertBackground?: boolean
}

/** What the `Hero` dispatcher itself reads — the variant discriminant only. */
export interface StorefrontHero {
  type: NativeHeroType
}

/** The `mediaBlock` layout block, minus `media` (typed locally by
 * `MediaBlock`, which also reads `media.caption`). */
export interface StorefrontMediaLayoutBlock {
  invertBackground?: boolean
  position?: 'default' | 'fullscreen'
  id?: string
  blockName?: string
  blockType?: 'mediaBlock'
}

/** One entry of `archive.populatedDocs`. `value` is left opaque: neither
 * `ArchiveBlock` nor `CollectionArchive` reads a field off a resolved entry
 * — `CollectionArchive` only seeds its result list from it. */
export interface StorefrontArchiveRelation {
  relationTo: 'products'
  value: unknown
}

/** The `archive` layout block, as `ArchiveBlock` (and, through it,
 * `CollectionArchive`) reads it. */
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
// Money and products
// ---------------------------------------------------------------------------

/** A price as the storefront renders it: an integer amount in the currency's
 * minor units plus the ISO currency code — the same representation the
 * domain layer uses (`src/lib/domain/money.ts`). Never a float, and never a
 * pre-formatted string, so the display locale stays a rendering decision.
 *
 * `null` means the product has no authoritative price set and is therefore
 * not purchasable; the UI renders nothing rather than guessing. */
export interface StorefrontPrice {
  amount: number
  currency: string
}

/** What `Price` reads. */
export interface StorefrontPriceableProduct {
  price?: StorefrontPrice | null
}

/** What cart-coupled code reads off a product: `id` for cart-line identity,
 * `title`/`slug` for the row's label and link, `meta.image` for its
 * thumbnail, and the price. */
export interface StorefrontCartProduct extends StorefrontPriceableProduct {
  id: string
  title: string
  slug?: string | null
  meta?: {
    image?: StorefrontMediaRef
  } | null
}

/** A product category as `CategoryCard`/`Categories`/`Filters` read it. */
export interface StorefrontCategory {
  id: string
  title?: string | null
  media?: StorefrontMediaRef
}

/** A category reference carried on a product — only id/title are ever
 * populated, which is all `ProductHero` reads. */
export interface StorefrontProductCategoryRef {
  id: string
  title?: string | null
}

/** A product as `Card`, `CollectionArchive` and `RelatedProducts` render it:
 * a summary tile with an image, a title, a description and a price. */
export interface StorefrontProductCard extends StorefrontPriceableProduct {
  id: string
  title?: string | null
  slug?: string | null
  categories?: (string | StorefrontProductCategoryRef)[]
  meta?: {
    title?: string | null
    description?: string | null
    image?: StorefrontMediaRef
  } | null
}

/** What `ProductHero` reads: the cart-product fields plus the category chips
 * and the meta description. */
export type StorefrontProductHeroView = Omit<StorefrontCartProduct, 'meta'> & {
  categories?: (string | StorefrontProductCategoryRef)[]
  meta?: {
    image?: StorefrontMediaRef
    description?: string | null
  } | null
}

/** What `generateMeta` reads off a page or product for SEO/Open Graph. */
export interface StorefrontMetaDoc {
  slug?: string | null
  meta?: {
    title?: string | null
    description?: string | null
    image?: StorefrontMediaRef
  } | null
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/** A row on the order-list pages. */
export interface StorefrontOrderSummary {
  id: string
  orderNumber: string
  total: number
  currency: string
  status: string
  createdAt: string
}

/** One line on the order-detail page. `unitPrice` is the price captured at
 * the time of the order — never re-read from the product, which may have
 * been repriced since. */
export interface StorefrontOrderItem {
  productId: string
  title: string
  quantity: number
  unitPrice: number
  currency: string
  slug?: string | null
  image?: StorefrontMediaRef
}

/** What the order-detail pages render. */
export interface StorefrontOrderDetail extends StorefrontOrderSummary {
  subtotal: number
  items: StorefrontOrderItem[]
  payment?: {
    provider: string
    status: string
    reference: string
    paidAt?: string | null
  } | null
}

/** Just an order's id — what a checkout response is read for. */
export interface StorefrontOrderReference {
  id: string
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** The current user as `AuthProvider` and account pages read them. Never
 * carries a password hash, salt or reset token: those live only on
 * `AuthUserRecord` (`src/lib/repositories/AuthUserRepository.ts`) and never
 * cross into the storefront. */
export interface StorefrontUser {
  id: string
  email: string
  name?: string | null
  roles: ('admin' | 'customer')[]
  purchases: (string | StorefrontProductCard)[]
  cart?: {
    items?: { id?: string; product?: string | StorefrontCartProduct; quantity?: number }[]
  } | null
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Page and product detail
// ---------------------------------------------------------------------------

/** A fully resolved CMS page, as `pageStorefrontAdapter.ts` assembles it. */
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

/** A fully resolved product detail document, as
 * `productStorefrontAdapter.ts` assembles it. `relatedProducts` carries
 * `StorefrontProductCard`s — the shape `RelatedProducts`/`Card` render. */
export interface StorefrontProductDetail extends StorefrontPriceableProduct {
  id: string
  title: string
  slug?: string | null
  _status?: 'draft' | 'published' | null
  enablePaywall?: boolean
  categories: StorefrontProductCategoryRef[]
  layout: StorefrontLayoutBlock[]
  relatedProducts: StorefrontProductCard[]
  meta?: {
    title?: string | null
    description?: string | null
    image?: StorefrontMediaItem
  } | null
  updatedAt: string
  createdAt: string
}
