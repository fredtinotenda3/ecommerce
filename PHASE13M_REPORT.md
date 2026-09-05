# PHASE 13M IMPLEMENTATION REPORT

## Files Migrated Off payload-types.ts

- `src/app/(pages)/checkout/CheckoutForm/index.tsx`

That is the only file, of the 42 audited, that qualified as a safe candidate under this
phase's criteria. See "Safe Candidate Criteria Used" and "Files Intentionally Left
Unchanged" below for why the other 41 do not.

## New View-Model Types Added

Added to `src/app/_types/storefront.ts`:

```
StorefrontOrderReference { id: string }
```

`CheckoutForm` posts to Payload's `/api/orders` REST endpoint after a successful Stripe
payment and destructures `{ error, doc }` from the JSON response, where `doc` was typed as
the full `payload-types.ts` `Order`. The only field ever read off `doc` is `doc.id` (used to
build the `/order-confirmation?order_id=...` redirect) — `.total`, `.items`,
`.stripePaymentIntentID`, etc. are never touched in this file. `StorefrontOrderReference`
is a genuine structural subset: any real `Order` object satisfies it unchanged, so retyping
`doc` this way changes nothing about what Payload sends or what the file does with it —
only what TypeScript requires the caller to have read first.

This is a different (smaller) type from the existing `StorefrontOrderSummary` (Phase 13G:
`{ id, total, createdAt }`), which the order-*list* pages use — kept separate because
`CheckoutForm` doesn't read `.total`/`.createdAt` at all, and conflating the two would
either force `CheckoutForm` to depend on fields it doesn't use or force the list pages to
lose fields they do use.

## Safe Candidate Criteria Used

A file was migrated only if, after tracing every read of the imported `payload-types.ts`
type through the file (including anything merely passed as a prop to another component),
**all** of the following held:

1. Only scalar fields are read from the type, or a single `.slug`/`.url`/`.title`/`.id`/
   `.filename` is read — never a populated relation's full shape.
2. Nothing derived from the type is passed to the `<Media />` display component as a
   `resource` (which needs `Media.sizes` — full `payload-types.ts` `Media`, out of scope
   per this phase's DO NOT list).
3. Nothing derived from the type is a `Page['layout']` / `Page['hero']` discriminated union,
   or a value read from one.
4. Nothing derived from the type touches the Cart provider/reducer's `CartItem`/`Product`
   coupling (`useCart()`'s `cart`, `addItemToCart`, `deleteItemFromCart`,
   `isProductInCart`).
5. The file is not itself one of the fetch/auth compatibility-boundary files this phase
   excludes by name (`fetchDoc`, `fetchDocs`, `getMe`, and — by the same reasoning, since
   they exist for exactly the same purpose (returning Payload-shaped data so downstream
   code needs zero changes regardless of data source) — the other native fetch helpers
   (`fetchCategoriesNative`, `fetchGlobals(Native)`, `fetchPageNative`,
   `fetchProductNative`, `meNative`), `getMeUser`, and the `Auth` provider/`nativeAuthUser`
   mapper.
6. The file is not a `*StorefrontAdapter.ts` file. All of them (not just
   `pageStorefrontAdapter.ts`/`productStorefrontAdapter.ts`, which the phase names
   explicitly) return values typed as full `payload-types.ts` shapes *on purpose*, so that
   native-repository data is indistinguishable from Payload data to every consumer — the
   same "adapter return shapes that intentionally mirror Payload" reasoning the phase
   brief calls out applies uniformly across `categoryStorefrontAdapter.ts`,
   `globalsStorefrontAdapter.ts`, `mediaStorefrontAdapter.ts`, `minimalProductAdapter.ts`,
   and `userStorefrontAdapter.ts`, not only the two named files.
7. Passing a value through to an already-narrowed component only counts as "safe" if that
   component's own prop type has already been narrowed off `payload-types.ts` — passing to
   a component that *itself* still requires a full Payload shape (e.g. `Card`, `Price`
   receiving a full `Product`, `ProductHero`) does not make the caller safe to narrow.

## Files Created

- `tests/storefrontOrderReference.test.ts` — 2 tests:
  - `StorefrontOrderReference` accepts a minimal `{ id }` object.
  - `StorefrontOrderReference` accepts a real `payload-types.ts` `Order` object unchanged
    (structural-subset check).

## Files Modified

- `src/app/_types/storefront.ts` — added `StorefrontOrderReference`. No existing exports
  changed.
- `src/app/(pages)/checkout/CheckoutForm/index.tsx` — `doc`'s type narrowed from `Order` to
  `StorefrontOrderReference`; `payload-types.ts` import dropped entirely (nothing else in
  the file referenced it).

## Files Deleted

(none)

## Files Intentionally Left Unchanged

Of the remaining 41 files that still import `payload-types.ts`, each falls into one or more
of these buckets (full per-file trace was done for all of them; grouped here for brevity):

**Full `Media` passed to `<Media />` (needs `.sizes`):**
`src/app/(pages)/account/orders/[id]/page.tsx`, `src/app/(pages)/orders/[id]/page.tsx`
(both pass a populated `Order.items[].product.meta.image` to `<Media resource={...} />`),
`src/app/_blocks/MediaBlock/index.tsx`, `src/app/_components/Card/index.tsx`,
`src/app/_heros/HighImpact/index.tsx`, `src/app/_heros/MediumImpact/index.tsx`,
`src/app/_heros/Product/index.tsx` — unchanged, consistent with Phase 13L's explicit
blocker for the last two, and `Media/types.ts` itself, which this phase's DO NOT list
prohibits modifying.

**CMS `Page['layout']` / `Page['hero']` discriminated unions:**
`src/app/(pages)/[slug]/page.tsx`, `src/app/(pages)/cart/page.tsx`,
`src/app/(pages)/products/page.tsx`, `src/app/_blocks/ArchiveBlock/types.ts`,
`src/app/_blocks/MediaBlock/index.tsx` (also in the bucket above),
`src/app/_components/CollectionArchive/index.tsx` (via `ArchiveBlockProps`),
`src/app/_components/Hero/index.tsx`, `src/app/_components/PaywallBlocks/index.tsx`.

**Passed through to a component that itself still needs a full Payload shape (not yet
narrowed, so the caller can't safely narrow either):**
`src/app/(pages)/products/[slug]/page.tsx` (passes `product` to `ProductHero`, and
`relatedProducts` to `RelatedProducts` → `Card`), `src/app/_blocks/RelatedProducts/index.tsx`
(→ `Card`), `src/app/_components/CollectionArchive/index.tsx` (→ `Card`, also in the bucket
above).

**Cart provider/reducer coupling:**
`src/app/_components/AddToCartButton/index.tsx`, `src/app/_components/RemoveFromCartButton/index.tsx`,
`src/app/_heros/Product/index.tsx` (also above, via `AddToCartButton`),
`src/app/_providers/Cart/index.tsx`, `src/app/_providers/Cart/reducer.ts`.

**Native fetch helpers / auth compatibility boundaries (return Payload-shaped data so
every existing consumer works unmodified regardless of data source):**
`src/app/_api/fetchCategoriesNative.ts`, `src/app/_api/fetchDoc.ts`, `src/app/_api/fetchDocs.ts`,
`src/app/_api/fetchGlobals.ts`, `src/app/_api/fetchGlobalsNative.ts`,
`src/app/_api/fetchPageNative.ts`, `src/app/_api/fetchProductNative.ts`,
`src/app/_api/getMe.ts`, `src/app/_api/meNative.ts`, `src/app/_providers/Auth/index.tsx`,
`src/app/_providers/Auth/nativeAuthUser.ts`, `src/app/_utilities/getMeUser.ts`.

**Adapter return shapes that intentionally mirror Payload:**
`src/lib/repositories/adapters/categoryStorefrontAdapter.ts`,
`src/lib/repositories/adapters/globalsStorefrontAdapter.ts`,
`src/lib/repositories/adapters/layoutRelationsAdapter.ts` (explicitly excluded by name),
`src/lib/repositories/adapters/mediaStorefrontAdapter.ts`,
`src/lib/repositories/adapters/minimalProductAdapter.ts`,
`src/lib/repositories/adapters/pageStorefrontAdapter.ts` (explicitly excluded by name),
`src/lib/repositories/adapters/productStorefrontAdapter.ts` (explicitly excluded by name),
`src/lib/repositories/adapters/userStorefrontAdapter.ts`.

**Prohibited from modification directly by this phase's DO NOT list:**
`src/app/_components/Media/types.ts`.

## Remaining payload-types Import Count

Using the same methodology as Phase 13L's report
(`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13M: 42**
- **After Phase 13M: 41**

## Existing Payload Status

Unchanged. Payload remains the default (flag-off) data source. `payload-types.ts` itself
was not touched. `StorefrontOrderReference` is a structural subset defined independently in
`src/app/_types/storefront.ts`, verified (via the new test) to still accept a real
`payload-types.ts` `Order` object unchanged. The default `/api/orders` REST flow
(flag-off Stripe checkout) was not modified — only the TypeScript type of a value already
returned unchanged from that same request.

## Existing Stripe Status

Unchanged. `CheckoutForm`'s Stripe `confirmPayment` call, its request bodies, and both the
native (`/api/orders/native`) and Payload (`/api/orders`) order-creation branches are
byte-for-byte unchanged — only the compile-time type of the already-existing `doc`
destructure changed.

## Remaining Blockers

- The same `HighImpactHero`/`MediumImpactHero` `Media`-type blocker noted in Phase 13L
  remains: closing it requires touching `Media/types.ts`, out of scope per this phase's
  (and 13L's) DO NOT list.
- All eight `*StorefrontAdapter.ts` files (not just the two named in this phase's DO NOT
  list) are structurally the same kind of compatibility boundary — they return
  `payload-types.ts`-shaped objects by design so the native-repository path is
  indistinguishable from Payload's to every existing consumer. None are safe to narrow
  without either changing what they return (risking a real behavior change for
  `USE_NATIVE_REPOSITORY=true`) or duplicating the narrowing decision one level up at every
  call site.
- The order-detail pages (`/orders/[id]`, `/account/orders/[id]`) remain on the full
  `Order` type because they render a populated `Product`'s `meta.image` through `<Media />`
  — same reasoning as the Phase 13G `StorefrontOrderSummary` doc comment already
  anticipated.
- The pre-existing, unrelated `tsc --noEmit` error in `src/app/_blocks/ArchiveBlock/index.tsx`
  (a `sort` prop not present on that block's `Props` type) remains, confirmed present before
  this phase's changes — not introduced by, and not fixed by, Phase 13M.

## Recommended Next Phase

- The remaining 41 files cluster tightly around exactly four hard boundaries: full `Media`
  (needs `Media/types.ts` changes), CMS layout/hero unions (needs a native CMS
  block/hero type system), Cart provider/reducer coupling (needs a Cart data-model
  decision), and the native-repository compatibility boundary (fetch helpers, auth, and all
  eight adapters, which by design return Payload-shaped data). Further reduction of this
  count without touching one of those four areas is not possible — Phase 13M's audit found
  only one file (`CheckoutForm`) that was a genuine structural-subset case sitting outside
  all four.
- A future phase should pick ONE of the four boundaries to open up explicitly (most likely
  `Media/types.ts`'s responsive-image logic, since `HighImpactHero`/`MediumImpactHero` are
  already fully migrated except for `media`), rather than continuing a general audit of the
  remaining files, since no more "free" candidates remain.
