// src/lib/domain/types.ts
//
// Pure domain types for the native application layer.
//
// RULES FOR THIS FILE (and everything under src/lib/domain, src/lib/services,
// src/lib/repositories *interfaces*, src/lib/payments):
//   - MUST NOT import from `payload`, `@payloadcms/*`, or `stripe`.
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

export interface ProductListFilter {
  status?: 'draft' | 'published'
  categoryId?: string
  ids?: string[]
  limit?: number
  page?: number
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
// Media
// ---------------------------------------------------------------------------

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
// PHASE 13D — mirrors the shape of Payload's Header/Footer/Settings globals
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
