# PHASE 13G IMPLEMENTATION REPORT

## Files Migrated Off payload-types.ts

Re-ran the file search: **57 files** outside `src/payload` import from
`payload-types.ts`, exactly matching the stated baseline. After this phase,
**51 files** remain — 6 files no longer import it at all:

| File | Was importing | Now |
|---|---|---|
| `orders/page.tsx` | `Order` | (nothing) |
| `account/orders/page.tsx` | `Order` | (nothing) |
| `checkout/page.tsx` | `Settings` | (nothing) |
| `logout/page.tsx` | `Settings` | (nothing) |
| `cart/CartPage/index.tsx` | `Page` (unused prop) | (nothing) |
| `_utilities/generateMeta.ts` | `Page`, `Product` | (nothing) |

Two further files were narrowed but still import `payload-types.ts` for a
separate, legitimate reason (kept exactly as-is per the task's exclusion
criteria), so they aren't in the "migrated off" count above but do carry
less payload-types surface area than before:

| File | Dropped | Kept, and why |
|---|---|---|
| `[slug]/page.tsx` | `Category` | `Page` — `hero`/`layout` are still CMS discriminated unions |
| `products/page.tsx` | `Category` | `Page` — `page.layout` is still a CMS discriminated union |
| `cart/page.tsx` | `Settings` | `Page` — `page.layout` (Blocks) and the whole `page` object (generateMeta) |

## New View-Model Types Added

Both added to the existing `src/app/_types/storefront.ts` (no new files —
extended the module the way its own header comment asks future phases to):

- **`StorefrontOrderSummary`** — `{ id: string; total: number; createdAt: string }`.
  The subset of `Order` that the order-*list* pages
  (`/orders`, `/account/orders`) read for a summary row. Deliberately
  excludes `.items`/`.stripePaymentIntentID`/any populated relation — the
  order-*detail* pages (`/orders/[id]`, `/account/orders/[id]`) need those
  (they render a populated `Product`'s image through the `Media` component,
  which needs `.sizes`), so those two pages were traced and confirmed to
  still need the full `Order` type and were left alone.

- **`StorefrontMetaDoc`** — `{ slug?; meta?: { title?; description?; image? } }`,
  reusing the existing `StorefrontMediaRef` for `meta.image` (so it's
  readable only for `.url`, never `.sizes`, same rule as every other view
  model in this file). The subset of `Page`/`Product` that `generateMeta`
  reads to build page `<title>`/description/Open Graph tags.

Both are structural subsets of the real `payload-types.ts` shapes (verified
directly against `Order`, `Page`, and `Product`'s interfaces in
`src/payload/payload-types.ts`), so every existing caller's real `Order[]`,
`Page`, `Product`, or `staticHome`/`staticCart` seed-fallback object
satisfies them unchanged — no adapter, fetch helper, or call site needed to
change to accommodate the new types themselves (only the narrowed local
variable declarations, listed above, changed).

## Safe Batch Criteria Used

Traced every one of the 57 files' actual runtime field reads (not just what
its declared prop type allows), then applied the task's own exclusion list:

- **Excluded, unchanged:** anything passing a full object to the `Media`
  display component (needs `.sizes`), anything consuming a `Page['layout']`
  / `Page['hero']` CMS discriminated union, anything coupled to the Cart
  provider/reducer's own `CartItem`/`Product` type (`AddToCartButton`,
  `RemoveFromCartButton`, `CheckoutForm`), all 8 repository adapters, all 9
  native fetch helpers/`fetchDoc`/`fetchDocs`/`getMe`, and the Auth
  provider — all by design, confirmed unchanged from Phase 13F-B's
  categorization.
- **Included, migrated:** components/pages where the *only* fields
  actually read (traced per-file, not per-type) are primitives or a single
  `.slug`/`.url`/`.title`/`.id` off an otherwise-populated relation, **or**
  a variable that is never read directly at all and only passed through to
  an already-narrowed callee (the `settings` pass-throughs) or dropped
  entirely as dead code (the `page` prop).

Two things outside a pure "which fields does this read" trace also
qualified as safe cleanup under this phase's "type-narrowing, no logic
change" scope:

1. **`CartPage`'s `page: Page` prop was genuinely unused** — declared in
   the type, destructured nowhere, read nowhere in the component body (the
   13F-B report flagged this and left it out of scope). Removing an unused
   prop is not a runtime behavior change: nothing depended on it either way.
   The one caller (`cart/page.tsx`) was updated in the same commit to stop
   passing it, so no dangling reference exists.
2. **The `settings`/`categories` pass-through pattern.** Three files
   (`checkout/page.tsx`, `logout/page.tsx`, and — newly following the same
   pattern — `cart/page.tsx`) fetch a `Settings` global purely to hand it,
   unread, to a component already narrowed to `StorefrontSettingsLike` in
   Phase 13F-B. Two files (`[slug]/page.tsx`, `products/page.tsx`) do the
   same for `Category[]` into components already narrowed to
   `StorefrontCategory[]`. Narrowing the local variable's type to match
   what its only consumer already accepts requires zero coordinated
   changes elsewhere.

## Files Created

- `tests/generateMeta.test.ts`

## Files Modified

- `src/app/(pages)/[slug]/page.tsx`
- `src/app/(pages)/account/orders/page.tsx`
- `src/app/(pages)/cart/CartPage/index.tsx`
- `src/app/(pages)/cart/page.tsx`
- `src/app/(pages)/checkout/page.tsx`
- `src/app/(pages)/logout/page.tsx`
- `src/app/(pages)/orders/page.tsx`
- `src/app/(pages)/products/page.tsx`
- `src/app/_types/storefront.ts`
- `src/app/_utilities/generateMeta.ts`

## Files Deleted

None.

## Files Intentionally Left Unchanged

Every other file in the original 57 was re-traced this phase and confirmed
to still need the full `payload-types.ts` shape it currently imports, for
one of the same root causes Phase 13F-B/13E already established:

- **Media/`Media.sizes`** — `Card`, `CollectionArchive` (renders `Card`),
  `RelatedProducts` (renders `Card`), `MediaBlock`, all four hero variants,
  `Footer`/`FooterComponent`, `Media/types.ts` itself, the order-*detail*
  pages (`/orders/[id]`, `/account/orders/[id]`), `products/[slug]/page.tsx`
  (passes the full `Product` into `ProductHero`, which needs `Media`), and
  `CheckoutForm` (order-confirmation flow doesn't touch this one, but its
  `Order` import is Cart-coupled — see below).
- **CMS block/layout unions** — `ArchiveBlock/types.ts`, `Blocks`,
  `CallToAction`, `Content`, `Header`/`HeaderComponent`/`Header/Nav`
  (`navItems` is a CMS link union), `PaywallBlocks`, `Hero/index.tsx`
  (typed directly as `Page['hero']`).
- **Cart provider/reducer coupling** — `AddToCartButton`,
  `RemoveFromCartButton`, `CheckoutForm` (order-creation payload is built
  from Cart's own `CartItem` shape).
- **Compatibility-boundary by design (Category 1, untouched)** — all 8
  `*StorefrontAdapter.ts` files, `fetchProductNative.ts`/`fetchPageNative.ts`/
  `fetchCategoriesNative.ts`/`fetchGlobalsNative.ts`/`meNative.ts`,
  `fetchDoc.ts`/`fetchDocs.ts` (their own `Config` type import — the
  `fetchDocs<StorefrontCategory>()` call sites added this phase only change
  the *caller's* generic type argument, not this file), `getMe.ts`,
  `getMeUser.ts`, the Auth provider and `nativeAuthUser.ts`.
- **`products/[slug]/page.tsx`** — `product` is passed whole into
  `ProductHero` (needs `Media`) and into `Blocks`'s `docs` (feeds
  `RelatedProducts` → `Card` → `Media`); no field-level narrowing is
  possible without touching those three.

## Validation Results

```
npm run lint       → 0 errors, 0 warnings
npx tsc --noEmit    → 1 pre-existing error (ArchiveBlock/index.tsx,
                      identical to the stated Phase 13F-B baseline —
                      confirmed unchanged, not touched this phase)
npm run test        → 372 passed (46 files) — 364 baseline + 8 new
                      (tests/generateMeta.test.ts), 0 failures
```

`npm run build` was not run per the task's explicit instruction.

## Existing Payload Status

Untouched. Not removed, not modified. `payload-types.ts` itself was not
edited — only which files import from it.

## Existing Stripe Status

Untouched. Not touched in any way this phase.

## Remaining payload-types Import Count

**51 files** outside `src/payload` (down from 57).

## Remaining Blockers

The three structural blockers Phase 13F-B already identified are still the
gating factor for the bulk of the remaining 51 files, and none were
addressed this phase (out of scope per the task's own "Do NOT" list):

1. **No native `Media.sizes` equivalent.** Every component rendering a
   populated `Media` through the `Media` display component needs it; there
   is nothing to narrow *to* until a native-friendly media shape with
   responsive-image data exists.
2. **CMS block/layout unions have no native equivalent.** `Page['layout']`/
   `Page['hero']` are deeply nested Payload-generated discriminated unions.
3. **Cart reducer's own `CartItem`/`Product` type.** `AddToCartButton`,
   `RemoveFromCartButton`, and `CheckoutForm` all pass their `product`
   straight into `useCart()`'s functions, which are typed against the
   reducer's own Payload-derived `Product` type.

## Recommended Next Phase

All of the "one relation, one field, pure pass-through" cases this repo
currently has appear to be exhausted now (the `settings.productsPage.slug`
and `categories`-pass-through families, plus the `generateMeta`/order-list
scalar-only cases found this phase). A further per-file trace pass is
unlikely to find more of this shape without first tackling one of the three
blockers above. Suggest picking one narrowly:

- A native `Media`-equivalent type carrying just `{ url, width, height }`
  (still not `.sizes`) could unblock `CategoryCard`-style `.url`-only
  consumers elsewhere, if any remain — worth a dedicated audit pass.
- Alternatively, scope out (in a planning-only phase, no code) what a
  native `Page['layout']`/`Page['hero']` equivalent would need to look
  like, since that's the single largest remaining category by file count.

============================================================
STOP CONDITION — honored. No Payload removal, no Stripe removal, no
production cutover in this phase. Waiting for explicit approval before any
of those.
============================================================
