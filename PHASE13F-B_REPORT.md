# PHASE 13F-B REPORT — Reduce dependence on payload-types.ts

## Objective

Begin migrating UI components and related code off `payload-types.ts`
imports where safe, without changing default behavior or breaking
visual rendering.

## Audit (Task 1–2)

Re-ran the file search: **65 files** outside `src/payload` import from
`payload-types.ts` (Phase 13E's audit found 68; the difference is Phase
13F-A adding/removing a couple of unrelated files in the interim, not a
prior migration — the same categories and root causes Phase 13E
identified are all still present). Reviewed every file's actual usage
(not just its import line) and grouped them into three categories:

### Category 1 — Compatibility-boundary by design (~20 files, unchanged)

Repository adapters (`src/lib/repositories/adapters/*StorefrontAdapter.ts`,
8 files), native fetch helpers (`fetchProductNative.ts`,
`fetchPageNative.ts`, `fetchCategoriesNative.ts`, `fetchGlobalsNative.ts`,
`meNative.ts`), `fetchDoc.ts`/`fetchDocs.ts`'s `Config` type, and
`getMe.ts`/`getMeUser.ts`/the Auth provider's `User` type. Confirmed
Phase 13E's finding still holds: these deliberately construct or return
`payload-types.ts`-shaped objects so `USE_NATIVE_REPOSITORY`/
`USE_NATIVE_AUTH` can swap the data source without touching a single UI
component. Importing `payload-types.ts` here is the intended design.

### Category 2 — Requires populated relations / Media.sizes / Cart-type coordination (~52 files, unchanged)

Everything that renders a `Media` object via the `Media` display
component (needs `.sizes` for `srcset`, which has no equivalent on
`domain/types.ts`), a CMS `layout`/block union (`ArchiveBlock`,
`Blocks`, `CallToAction`, `Content`, `MediaBlock`, hero variants,
`RelatedProducts`), or the Cart provider/reducer's `CartItem`/`Product`
type (`AddToCartButton`, `RemoveFromCartButton`, `CartPage`'s cart
rendering, `CheckoutForm`'s order payload, `Header/Nav`'s `navItems`).
Left alone per the task's own guidance — genuinely requires a
coordinated component refactor I can't visually verify in this
environment.

### Category 3 — Safe: narrow, scalar-only usage (8 files, migrated this phase)

Found by tracing exactly which fields each component actually reads off
its Payload-typed prop, rather than just what the prop's declared type
allows. Five components read **only** primitive/scalar fields or a
single `.slug`/`.url` off an otherwise-populated relation, never
anything requiring `Media.sizes` or a CMS block union:

| Component | Only ever reads |
|---|---|
| `Price` | `product.priceJSON` |
| `CMSLink` (`Link/index.tsx`) | `reference.value.slug` |
| `CategoryCard` | `category.id` / `.title` / `.media.url` (never `.sizes`) |
| `Categories` | passes `Category[]` straight through to `CategoryCard` |
| `Filters` | `category.id` / `.title` |

While migrating these, found the exact same pattern one level up: three
page-level components take a `settings: Settings` prop but only ever
read `settings.productsPage.slug` (a "continue shopping" link) — never
any other field on the `Settings` global:

| Component | Only ever reads |
|---|---|
| `CartPage` | `settings.productsPage.slug` |
| `LogoutPage` | `settings.productsPage.slug` |
| `CheckoutPage` | `settings.productsPage.slug` |

All eight qualify as safe under the task's own criterion: "components
that receive simple shapes and do not use populated relations or
Media.sizes."

## Migration approach (Task 3)

Created `src/app/_types/storefront.ts` — a new, dedicated module of
narrow "view-model" interfaces:

- `StorefrontPriceableProduct` — `{ priceJSON?: string | null }`
- `StorefrontLinkablePage` — `{ slug?: string | null }`
- `StorefrontMediaRef` — `string | { url?: string | null } | null | undefined`
- `StorefrontCategory` — `{ id: string; title?: string | null; media?: StorefrontMediaRef }`
- `StorefrontSettingsLike` — `{ productsPage?: string | StorefrontLinkablePage | null }`

These are **structural subsets** of `payload-types.ts`'s real
`Product`/`Page`/`Category`/`Settings` — not new domain types, and not
`domain/types.ts` reuse (the native domain shapes have no
`priceJSON`/CMS-`slug` fields, since the storefront still runs on
Payload-shaped data by default; reusing them would have been
incompatible with what these components actually receive at runtime).
Because they're subsets, every real `Product`/`Category`/`Page`/
`Settings` object — and every native-adapter-built equivalent, which is
deliberately built to match `payload-types.ts`'s shape (Category
1 above) — satisfies them structurally with **zero changes anywhere
else**: no adapter, no page-level data-fetching code, no call site was
touched. Only the eight leaf components' own prop-type declarations
changed, each to the narrowest interface it actually needs. One
`import`-only cleanup: `CartPage/index.tsx` kept its `Page` import
(used for an already-unused `page` prop — not touched, out of scope)
but dropped `Settings`.

Also removed one now-redundant runtime cast:
`CategoryCard/index.tsx` previously did
`category.media as Media | string | null | undefined` to satisfy the
compiler; with `category: StorefrontCategory`, `category.media` is
already typed as `StorefrontMediaRef`, so the cast was deleted (a
one-line simplification, not a behavior change — same runtime value,
same subsequent `typeof media === 'object'` check).

## Tests (Task 4)

None of the eight components' *runtime* logic changed — this was a
type-level narrowing only, and the existing 356 tests (none of which
exercise these components — there is no React-component test
infrastructure in this repo, confirmed via `package.json`/
`vitest.config.ts`: `environment: 'node'`, no `@testing-library/*`
dependency) all still pass unmodified.

The one piece of actual runtime logic touched by this migration is
`priceFromJSON` (exported from `Price/index.tsx`) — not modified, but
it had **zero test coverage** before this phase, and it's the only
function whose input shape is now explicitly documented as "just
`priceJSON`" rather than "some field on a full `Product`". Added
`tests/priceFromJSON.test.ts` (8 cases): one-time price formatting,
quantity multiplication, `raw` mode, recurring-price interval suffixes
(both `interval_count: 1` and `> 1`), empty/falsy input, malformed JSON
(caught, returns `''`, doesn't throw), and — the case most directly
tied to this phase — calling it with a plain `{ priceJSON }` object
that has no other `Product` fields, to lock in that the narrower
`StorefrontPriceableProduct` shape is genuinely sufficient.

## Validation (Task 5)

```
npm run lint       → 0 errors, 0 warnings (after `eslint --fix`,
                      which only reordered import statements — no
                      logic changed)
npx tsc --noEmit    → 1 pre-existing error (ArchiveBlock/index.tsx,
                      unrelated to this phase — present in the Phase
                      13E/13F-A baseline too)
npm run test        → 364 passed (45 files) — 356 baseline + 8 new
                      (tests/priceFromJSON.test.ts), 0 failures
```

`npm run validate:flags` was not part of this phase's task list (no
flags were added or changed) and was not run.

## Why the rest were left alone

Re-confirming Phase 13E's finding, now with concrete per-file evidence
rather than a category-level argument:

1. **Media/`Media.sizes`.** Any component that renders a populated
   `Media` object through the `Media` display component (`Card`,
   `CollectionArchive`, `MediaBlock`, hero variants, `Footer`,
   `RelatedProducts`, `CheckoutItem`, `CartItem`, etc.) needs
   `Media.sizes` for responsive `srcset` — `domain/types.ts`'s `Media`
   interface has no equivalent field at all, so this can't even be
   narrowed the way `CategoryCard` was (which only ever needed `.url`,
   never `.sizes`).
2. **CMS block/layout unions.** `ArchiveBlock`, `Blocks`, `CallToAction`,
   `Content`, hero variants, `PaywallBlocks` all consume `Page['layout']`
   or `Page['hero']` — deeply nested discriminated unions that are
   Payload-generated and have no native equivalent to narrow *to*.
3. **Cart provider/reducer coupling.** `AddToCartButton`,
   `RemoveFromCartButton`, `CartPage`'s cart-item rendering, and
   `CheckoutForm`'s order-creation payload all pass their `product`
   straight into `useCart()`'s `addItemToCart`/`isProductInCart`/
   `deleteItemFromCart`, which are typed against the Cart reducer's own
   `CartItem`/`Product` type (`= CartItems[0]`, itself imported from
   `payload-types.ts`). Narrowing any one of these without also
   updating the Cart provider/reducer's types would just move the
   `payload-types.ts` dependency one file over, not remove it — that's
   a coordinated, larger change than this phase's "leaf component,
   independently safe" scope.
4. **Return-type-of-real-fetch files (Category 1).** `getMe.ts`,
   `fetchGlobals.ts`, and the native fetch helpers are typed by what
   they actually fetch — Payload-shaped data on the default path,
   deliberately Payload-shaped data on the native-adapter path (Phase
   2/8's design). Nothing to narrow without changing what's fetched.

## Recommended next phase

The `settings.productsPage`/`StorefrontSettingsLike` pattern found in
this phase (three components, same exact shape) suggests there may be
a few more "one relation, one field" cases like it elsewhere in
Category 2's ~52 files that a closer per-file trace (rather than a
category-level judgment call) would surface — worth another
enumerate-and-trace pass before attempting the genuinely coordinated
work (Cart reducer retyping, a native `Media.sizes` equivalent, a
native block/layout union) that the bulk of the remaining files
actually need.

## Do NOT / unchanged confirmations

- `payload-types.ts` was not removed or modified.
- Payload and Stripe are untouched.
- No adapter, page-level fetch, or Cart provider/reducer code was
  touched — every migrated component's new, narrower prop type is
  satisfied by the exact same objects every existing caller already
  passes it.
- Default (flag-off) behavior is unchanged: this phase added no flags
  and changed no runtime logic, only type annotations (plus the one
  redundant-cast removal noted above, which is not a behavior change).
