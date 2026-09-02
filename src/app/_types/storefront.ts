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

/** Anything with a `.url` — matches both `payload-types.ts`'s `Media`
 * and the bare media-id-string state a `string | Media` relation field
 * can be in before population. Deliberately does NOT include `.sizes`
 * (needed for responsive `srcset`) — nothing typed with this should be
 * passed to the `Media` display component; see `CategoryCard`, which
 * only ever reads `.url` for a CSS `background-image`. */
export type StorefrontMediaRef = string | { url?: string | null } | null | undefined

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
