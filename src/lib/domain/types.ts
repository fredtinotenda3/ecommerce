// src/lib/domain/types.ts
//
// Pure domain types for the native application layer.
//
// RULES FOR THIS FILE (and everything under src/lib/domain, src/lib/services,
// src/lib/repositories *interfaces*, src/lib/payments):
//   - MUST NOT import a framework, an ORM, or a payment SDK.
//   - MUST NOT import Mongoose. Mongoose is an infrastructure concern that
//     belongs in src/lib/db/models and the repository *implementations* only.
//
// These types intentionally mirror the shape of the existing Payload
// collections closely enough that a repository can map a Mongo document
// onto them without semantic loss, but they are NOT Payload types — this
// file is the seam the rest of the migration will build on.

/** All monetary amounts in this codebase are integers in MINOR UNITS
 * (e.g. cents for USD). Never store or compare money as a float. */
export type MinorUnits = number

export type CurrencyCode = string // ISO 4217, e.g. 'USD'

export interface Money {
  amount: MinorUnits
  currency: CurrencyCode
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export interface Product {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'

  /** Authoritative native price. Introduced in Phase 1B. May be `null` for
   * products that have not yet been backfilled from `legacyPriceJSON` — see
   * scripts/migrations/backfillProductPrices.ts. The application must treat
   * a null price as "not yet purchasable", never fall back to a client-
   * supplied or legacy Stripe price. */
  price: MinorUnits | null
  currency: CurrencyCode | null
  compareAtPrice: MinorUnits | null

  categories: string[]
  relatedProducts: string[]
  enablePaywall: boolean

  /** Present only for backward compatibility / migration traceability.
   * Never read by new business logic for pricing decisions. */
  legacyStripeProductId: string | null
  legacyPriceJSON: string | null

  /** Flexible block-based layout for the Product detail page — same
   * "intentionally untyped, owned by the CMS/render layer" treatment as
   * `Page.layout` (see below). Added in Phase 3 so the native Product
   * detail path can reproduce the current `Blocks` renderer output
   * (cta/content/mediaBlock/archive blocks). */
  layout: unknown[]

  /** Flexible block-based content gated behind the paywall — same
   * "intentionally untyped, owned by the CMS/render layer" treatment as
   * `layout` above. Added in Phase 13A so the native product read path
   * can resolve this (see fetchPaywallNative.ts); it deliberately mirrors
   * Payload's own field-level access control
   * (src/payload/collections/Products/access/checkUserPurchases.ts)
   * rather than being exposed unconditionally like `layout` is — see
   * fetchPaywallNative.ts for the authorization check. */
  paywall: unknown[]

  meta: {
    title?: string
    description?: string
    imageId: string | null
  }

  createdAt: Date
  updatedAt: Date
}

export type ProductSort = 'newest' | 'oldest' | 'price-asc' | 'price-desc' | 'title'

export interface ProductListFilter {
  status?: 'draft' | 'published'
  /** Single-category filter. Kept alongside `categoryIds` because most
   * callers only ever filter by one. */
  categoryId?: string
  /** Multi-category filter: a product matches if it belongs to ANY of
   * these (union, not intersection — which is what a shopper ticking two
   * boxes in a facet list expects). */
  categoryIds?: string[]
  ids?: string[]
  /** Free-text search over the product title and meta description. Matched
   * case-insensitively as a substring, not as a ranked full-text query:
   * the catalogue is small enough that a scan is cheaper than maintaining a
   * text index, and substring matching is what a shopper typing "macbook"
   * into a store search box expects. Callers are responsible for trimming
   * and length-capping the term. */
  search?: string
  limit?: number
  page?: number
  sort?: ProductSort
}

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export interface Category {
  id: string
  title: string
  mediaId: string | null
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Page (CMS)
// ---------------------------------------------------------------------------

export interface Page {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  /** Flexible block-based layout — intentionally untyped (Mixed) at this
   * layer since block schema is owned by the CMS/render layer, not the
   * domain layer. */
  layout: unknown[]
  hero: unknown
  meta: {
    title?: string
    description?: string
    imageId?: string | null
  }
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// CMS layout / hero — native types (PHASE 13I)
// ---------------------------------------------------------------------------
//
// FOUNDATION ONLY — see docs/native-cms-layout-plan.md (written in Phase
// 13H) for the full design record this section implements step 1 of.
//
// These types are a pure, additive alternative to `Page.layout: unknown[]`
// / `Page.hero: unknown` / `Product.layout: unknown[]` above — they do NOT
// replace those fields yet, and NOTHING in the codebase constructs or
// consumes them yet (no adapter, no repository, no component). That wiring
// is explicitly later phases (see the plan's "Suggested sequencing" §5,
// steps 2 onward).
//
// Mirrors the stored `Page['layout']` / `Page['hero']` shape
// shape (`Product['layout']` reuses the identical four block shapes) field-
// for-field closely enough that a future mapping layer can convert between
// them without semantic loss — but every field here is built from this
// file's OWN vocabulary (`Media`, `Product`, `Category`, `Page` as declared
// above in this file, plus the few new supporting types below), never
// imported from a generated type. Same treatment as
// this file's existing `Media` type, which already deliberately duplicates
// rather than imports Payload's generated `Media`.
//
// `id`/`blockName` are carried on every block (as they are in Payload's
// generated types) even though nothing reads them today, for structural
// parity with the source shape this is modelled on.

/** A single Lexical/Slate-style rich text node. Same "untyped payload,
 * typed container" treatment as `Media.caption` above and the existing
 * `layout: unknown[]` fields — rich text's internal node shape is owned by
 * the CMS/render layer, not the domain layer, but the field itself (an
 * array of these) is now a named type instead of bare `unknown[]`. */
export type NativeRichTextNode = Record<string, unknown>

export type NativeLinkAppearance = 'default' | 'primary' | 'secondary'

/** Mirrors the `CMSLinkShape` documented in
 * docs/native-cms-layout-plan.md §1 — shared verbatim by `hero.links`,
 * `cta.links`, and `content.columns[].link` in the Payload source shape.
 * `reference.value` is `string | Page` (unresolved id vs. populated doc),
 * matching how `layoutRelationsAdapter.ts`'s `resolveLink` already
 * represents a resolved reference today (just against this native `Page`
 * instead of the stored document's). */
export interface NativeCMSLink {
  type?: 'reference' | 'custom'
  newTab?: boolean
  reference?: {
    relationTo: 'pages'
    value: string | Page
  }
  url?: string
  label: string
  icon?: string | Media
  appearance?: NativeLinkAppearance
}

/** Wrapper Payload puts around every link in a `links` array (adds the
 * array-item `id`, distinct from the link's own fields). */
export interface NativeLinkGroupItem {
  id?: string
  link: NativeCMSLink
}

export interface NativeCallToActionBlock {
  blockType: 'cta'
  id?: string
  blockName?: string
  invertBackground?: boolean
  richText: NativeRichTextNode[]
  links?: NativeLinkGroupItem[]
}

export interface NativeContentColumn {
  id?: string
  size?: 'oneThird' | 'half' | 'twoThirds' | 'full'
  richText: NativeRichTextNode[]
  enableLink?: boolean
  link?: NativeCMSLink
}

export interface NativeContentBlock {
  blockType: 'content'
  id?: string
  blockName?: string
  invertBackground?: boolean
  columns?: NativeContentColumn[]
}

/** Named `NativeMediaLayoutBlock`, not `NativeMediaBlock`, to avoid
 * ambiguity with `Media` above (this is the CMS *block* that displays a
 * media item, not a media item itself). */
export interface NativeMediaLayoutBlock {
  blockType: 'mediaBlock'
  id?: string
  blockName?: string
  invertBackground?: boolean
  position?: 'default' | 'fullscreen'
  media: string | Media
}

/** A single entry in `archive.selectedDocs` / `archive.populatedDocs` —
 * Payload's generated type unions the unresolved (`value: string`) and
 * resolved (`value: Product`) forms into two distinct array types; this
 * flattens that into one item type with a `string | Product` value,
 * matching how `NativeCMSLink.reference.value` above handles the same
 * unresolved-vs-resolved distinction for pages. */
export interface NativeArchiveRelation {
  relationTo: 'products'
  value: string | Product
}

/** Per docs/native-cms-layout-plan.md §3.6, `categories` and
 * `selectedDocs` are NOT relation-resolved by `layoutRelationsAdapter.ts`
 * today (no current component reads them) — modelled here as `string[]`
 * only (unresolved ids), NOT `string[] | Category[]` like
 * the stored shape does, since nothing in this codebase produces the
 * resolved form yet. Widening this to allow `Category[]` is a decision
 * explicitly deferred to the "migrate archive" step (plan §5, step 7),
 * once/if that resolution gap is closed. `populatedDocs`, which IS
 * resolved today (see `resolveArchivePopulatedDocs`), keeps the
 * `string | Product` union via `NativeArchiveRelation` above so a future
 * mapping layer can represent either state. */
export interface NativeArchiveBlock {
  blockType: 'archive'
  id?: string
  blockName?: string
  introContent: NativeRichTextNode[]
  populateBy?: 'collection' | 'selection'
  relationTo?: 'products'
  categories?: string[]
  limit?: number
  selectedDocs?: NativeArchiveRelation[]
  populatedDocs?: NativeArchiveRelation[]
  populatedDocsTotal?: number
}

/** Discriminated on `blockType` as a literal (not widened to `string`),
 * matching docs/native-cms-layout-plan.md §5's "Risks" note on preserving
 * TypeScript's control-flow narrowing through the union — required for
 * any future `Blocks`-style dispatcher built against this type to narrow
 * correctly. Covers the four real CMS-authored blocks only; `relatedProducts`
 * is explicitly out of scope (see the plan §1 — it's synthesized by
 * `RelatedProducts`/`ProductHero` at render time, not a Payload block). */
export type NativeLayoutBlock =
  | NativeCallToActionBlock
  | NativeContentBlock
  | NativeMediaLayoutBlock
  | NativeArchiveBlock

export type NativeHeroType = 'none' | 'highImpact' | 'mediumImpact' | 'lowImpact' | 'customHero'

/** Mirrors `Page['hero']` — note this is a single shape with a `type`
 * discriminant field, NOT a discriminated union of per-type shapes: every
 * hero variant (`highImpact`/`mediumImpact`/`lowImpact`/`customHero`)
 * shares the same `richText`/`links`/`media` fields in the Payload source
 * shape, and the hero *component* chosen at render time is what varies,
 * not the data shape. `ProductHero` (see the plan §1) is out of scope —
 * it does not consume `Page['hero']` at all. */
export interface NativeHero {
  type: NativeHeroType
  richText: NativeRichTextNode[]
  links?: NativeLinkGroupItem[]
  media: string | Media
}

export interface Media {
  id: string
  alt: string
  url: string | null
  filename: string | null
  mimeType: string | null
  filesize: number | null
  width: number | null
  height: number | null
  /** Rich text, same "untyped at this layer" treatment as `Page.layout` —
   * only read by the storefront's MediaBlock/Hero components to render an
   * optional caption beneath an image. Added in Phase 3 because the
   * Product detail / CMS Page media blocks require it; not read anywhere
   * for admin or write paths. */
  caption: unknown
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export type Role = 'admin' | 'customer'

export interface CartItem {
  productId: string
  quantity: number
}

export interface User {
  id: string
  name: string | null
  email: string
  roles: Role[]
  purchases: string[]
  cart: CartItem[]

  /** Historical reference only — never used by new payment logic. */
  legacyStripeCustomerId: string | null

  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'PROCESSING'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'REFUNDED'

/** Valid forward transitions for an Order's status. Enforced by
 * OrderService.transitionStatus — never mutate `status` directly. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PAYMENT_FAILED: ['PENDING_PAYMENT', 'CANCELLED'],
  PAYMENT_CANCELLED: ['PENDING_PAYMENT', 'CANCELLED'],
  PROCESSING: ['FULFILLED', 'REFUNDED'],
  FULFILLED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
}

export interface OrderItem {
  productId: string
  title: string
  /** The price actually charged for this item, frozen at order-creation
   * time. MUST NEVER be recalculated from the product's current price
   * after the fact — see OrderService and the audit's Order Domain
   * findings. */
  unitPrice: MinorUnits
  currency: CurrencyCode
  quantity: number
}

export interface Order {
  id: string
  /** Unique, customer-facing order number AND the merchant reference
   * handed to the payment provider. Used for idempotency — see
   * PaymentService. */
  orderNumber: string
  customerId: string
  items: OrderItem[]
  subtotal: MinorUnits
  total: MinorUnits
  currency: CurrencyCode
  status: OrderStatus

  /** Present only for orders created before this migration, where the
   * legacy Stripe checkout flow created the order directly. Never
   * populated by new order-creation code. */
  legacyStripePaymentIntentId: string | null

  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Payment / PaymentAttempt
// ---------------------------------------------------------------------------

export type PaymentProviderName = 'stripe' | 'paynow'

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED'

export const PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  FAILED: ['PENDING'], // allow a fresh attempt to be initiated
  CANCELLED: ['PENDING'],
  REFUNDED: [],
}

export interface Payment {
  id: string
  orderId: string
  provider: PaymentProviderName
  /** The provider's own identifier for this payment (Stripe PaymentIntent
   * id, Paynow poll URL/reference, etc). */
  providerReference: string | null
  /** The value we generated and handed to the provider — this is what
   * idempotency and callback matching are keyed on, NOT providerReference,
   * since providerReference may not be known until after initiation. */
  merchantReference: string
  amount: MinorUnits
  currency: CurrencyCode
  status: PaymentStatus
  paymentMethod: string | null
  initiatedAt: Date
  paidAt: Date | null
  failedAt: Date | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export type PaymentAttemptStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED'

export interface PaymentAttempt {
  id: string
  orderId: string
  paymentId: string | null
  provider: PaymentProviderName
  merchantReference: string
  status: PaymentAttemptStatus
  requestPayload: Record<string, unknown> | null
  responsePayload: Record<string, unknown> | null
  errorMessage: string | null
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Site globals (Header / Footer / Settings)
// ---------------------------------------------------------------------------
//
// mirrors the shape of Payload's Header/Footer/Settings globals
// (see src/payload/globals/{Header,Footer,Settings}.ts and the shared `link`
// field builder at src/payload/fields/link.ts) closely enough for a
// repository to map a Mongo `globals` document onto them without semantic
// loss. Only the fields the storefront actually reads are modelled — same
// "intentionally narrow" treatment as the rest of this file.

export interface NavLink {
  type?: 'reference' | 'custom'
  newTab?: boolean
  label?: string | null
  /** Only meaningful when `type === 'custom'`. */
  url?: string | null
  /** Id of the linked Page. Only meaningful when `type === 'reference'`;
   * resolution to a slug happens in the storefront-read orchestrator
   * (see fetchGlobalsNative.ts), not here. */
  referencePageId?: string | null
  /** Mirrors Payload's polymorphic `reference.relationTo` — always 'pages'
   * today (the `link` field only ever declares `relationTo: ['pages']`). */
  referenceRelationTo?: 'pages' | null
  /** Id of the optional icon Media doc. Resolved to a URL by the caller. */
  iconMediaId?: string | null
}

export interface NavItem {
  link: NavLink
}

export interface Header {
  id: string
  navItems: NavItem[]
  createdAt: Date
  updatedAt: Date
}

export interface Footer {
  id: string
  copyright: string | null
  navItems: NavItem[]
  createdAt: Date
  updatedAt: Date
}

export interface Settings {
  id: string
  /** Id of the linked "products" Page. Resolution to a slug happens in the
   * storefront-read orchestrator (see fetchGlobalsNative.ts). */
  productsPageId: string | null
  createdAt: Date
  updatedAt: Date
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

/** A managed redirect from one path on this site to another location.
 *
 * `from` is always a root-relative path (`/old-thing`). `to` is either
 * another root-relative path or an absolute URL. `permanent` selects 308
 * vs 307 — permanent redirects are cached hard by browsers, so the default
 * is deliberately temporary and making one permanent is an explicit act. */
export interface Redirect {
  id: string
  from: string
  to: string
  permanent: boolean
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}
