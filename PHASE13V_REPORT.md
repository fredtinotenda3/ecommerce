# PHASE 13V IMPLEMENTATION REPORT

## View Model Added

`StorefrontHeroMedia` — `src/app/_types/storefront.ts`

```ts
export interface StorefrontHeroMedia extends StorefrontMediaItem {
  caption?: StorefrontRichText
}
```

(`StorefrontMediaItem` itself — `url?`/`width?`/`height?`/`alt?`/`filename?`/`mimeType?` — already existed from Phase 13H/13N; not modified by this phase.)

Two callers read `.caption` directly off a populated media object, in addition to forwarding it to `<Media resource={...} />`: `HighImpactHero` (`media?.caption`) and `MediaBlock` (`media.caption`). Those two use `StorefrontHeroMedia`; `ProductHero` and `MediumImpactHero` never read `.caption`, so they use plain `StorefrontMediaItem`.

## Files Migrated

`src/app/_components/Media/types.ts` — `Props.resource` narrowed from `string | payload-types.ts Media` to `string | StorefrontMediaItem`. This is the Phase 13N audit's flagged follow-up: that audit traced every line of `Media/index.tsx`, `Media/Image/index.tsx`, and `Media/Video/index.tsx` and confirmed the rendering logic only ever reads `mimeType`/`width`/`height`/`filename`/`alt` off `resource` — exactly `StorefrontMediaItem`'s field set — and that `payload-types.ts`'s generated `Media` has no `.sizes` field to begin with. No rendering logic in `Image`/`Video`/`Media` was touched, per the DO-NOT list.

Five components migrated their media-bearing prop off the full `payload-types.ts` `Media` onto the new view models, each dropping its `payload-types.ts` import entirely:

| Component | Field | New type |
|---|---|---|
| `ProductHero` | `meta.image` | `string \| StorefrontMediaItem` |
| `HighImpactHero` | `media` | `string \| StorefrontHeroMedia` |
| `MediumImpactHero` | `media` | `string \| StorefrontMediaItem` |
| `MediaBlock` | `media` | `string \| StorefrontHeroMedia` |

`Card` was inspected (task list item) but not migrated — see "Files Intentionally Left Unchanged" below for why, and confirmation that it still compiles and renders unchanged regardless.

## Files Created

`tests/mediaResourceViewModel.test.ts` — type-level regression tests (Task 5):
- `Media/types.ts`'s narrowed `Props.resource` still accepts a real `payload-types.ts` `Media` object, and a bare string.
- `StorefrontHeroMedia` still accepts a real `Media` object, including `.caption`.
- `ProductHero`'s prop type still accepts a real `payload-types.ts` `Product` with a populated `meta.image` (a real `Media` object) and with an unresolved string `meta.image`.
- `HighImpactHero`/`MediumImpactHero`'s prop types still accept a real `Media` object for `media` unchanged.
- `MediaBlock`'s prop type still accepts a real `Media` object (with caption) and an unresolved string (`''`, matching the styleguide page's usage) for `media` unchanged.

## Files Modified

- `src/app/_components/Media/types.ts`
- `src/app/_types/storefront.ts`
- `src/app/_heros/Product/index.tsx`
- `src/app/_heros/HighImpact/index.tsx`
- `src/app/_heros/MediumImpact/index.tsx`
- `src/app/_blocks/MediaBlock/index.tsx`

## Files Deleted

None.

## Files Intentionally Left Unchanged

- **`src/app/_components/Card/index.tsx`** — still declares `doc: Product` (the full `payload-types.ts` `Product`), needed for fields this phase doesn't touch (`title`, `categories`, `priceJSON` — a full Card/RelatedProducts migration, tracked since Phase 13S as its own follow-up, not part of this phase's task list). `Card`'s `metaImage` (`doc.meta.image`, typed `string | Media` via the full `Product`) is still passed to `<Media resource={metaImage} fill />` and continues to type-check against the new `string | StorefrontMediaItem` signature with **no code change**, because a real `payload-types.ts` `Media` object already structurally satisfies `StorefrontMediaItem` (confirmed by `tsc --noEmit` across the whole project). Narrowing `Card`'s own `doc` prop is out of scope here.
- **`src/app/(pages)/account/orders/[id]/page.tsx`**, **`src/app/(pages)/orders/[id]/page.tsx`** — both destructure `meta.image` off `item.product` (typed via the full `payload-types.ts` `Order`, imported for `total`/`items`/`stripePaymentIntentID`, none of which this phase narrows) with no separate declared prop type for the value handed to `<Media resource={...} />`. Nothing to change; both still compile against the new `Media/types.ts` signature unchanged.
- **`src/app/(pages)/account/purchases/page.tsx`**, **`src/app/(pages)/cart/CartItem/index.tsx`**, **`src/app/(pages)/checkout/CheckoutItem/index.tsx`** — all pass a media value to `<Media resource={...} />` with no declared component-level prop types at all (plain destructured function parameters, `('use client')` components). Nothing to change; all still compile unchanged.
- **`src/app/_heros/CustomHero/index.tsx`** — already on `string | StorefrontMediaItem` for `media` since Phase 13L (it never passes `media` to `<Media />`, only reads `.filename` for a CSS background); not touched here.
- **`src/app/_components/Media/Image/index.tsx`**, **`.../Video/index.tsx`**, **`.../index.tsx`** — rendering logic untouched, per the DO-NOT list. They still import `Props` from `./types`, now backed by `StorefrontMediaItem` instead of the full `Media`; no other change.
- `src/payload/payload-types.ts` — Payload untouched.
- `src/app/_providers/Cart/*` (provider/reducer) — not touched.
- `src/lib/repositories/adapters/*.ts`, `src/app/_api/fetch*.ts` — not touched.
- `src/app/_components/Price/index.tsx`, `src/app/_components/AddToCartButton/index.tsx` — unaffected; neither reads media fields.

## New Dependencies

None.

## Existing Payload Status

Unchanged. Payload remains the default data source; nothing in this phase removes or bypasses it. `payload-types.ts`'s `Media`/`Product`/`Order` interfaces are untouched.

## Existing Stripe Status

Unchanged. Not touched by this phase.

## Remaining payload-types Import Count

Using the same methodology as prior phases' reports (`grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l`):

- **Before Phase 13V: 32**
- **After Phase 13V: 27**

Five files dropped off the list: `src/app/_components/Media/types.ts`, `src/app/_heros/Product/index.tsx`, `src/app/_heros/HighImpact/index.tsx`, `src/app/_heros/MediumImpact/index.tsx`, `src/app/_blocks/MediaBlock/index.tsx`.

## Remaining Blockers

- `src/app/_components/Card/index.tsx` and `src/app/_blocks/RelatedProducts/index.tsx` still import the full `payload-types.ts` `Product` — this phase's media-only scope doesn't touch `Card`'s non-media fields (`title`/`categories`/`priceJSON`), so `Card` can't drop its `payload-types.ts` import yet even though its media handling is already compatible with the new `StorefrontMediaItem`-based `Media` component.
- The order-detail pages (`account/orders/[id]`, `orders/[id]`) and `account/purchases/page.tsx` still import the full `payload-types.ts` `Order`/read an untyped `user.purchases` — none of that was narrowed this phase (out of task scope), so they remain on the import list even though their `<Media />` calls now work against the narrower type with no change.
- Pre-existing, unrelated `tsc --noEmit` failure (present before this phase's changes, not introduced by them, and not touched by this phase's files): `src/app/_blocks/ArchiveBlock/index.tsx(40,9)` — `CollectionArchive`'s `Props` type doesn't declare a `sort` prop that `ArchiveBlock` passes it.

## Recommended Next Phase

**Phase 13W**: Narrow `Card`'s `doc` prop (and `RelatedProducts`' `docs` prop) to a dedicated `StorefrontProductSummary` view model covering exactly `id`/`slug`/`title`/`categories`/`meta.description`/`meta.image`/`priceJSON` — the fields `Card` actually reads (now including `meta.image` as `StorefrontMediaItem`, following this phase's pattern). That would let both files drop their `payload-types.ts` `Product` import, likely the next-largest reduction to the import count, and would let `StorefrontProductDetail.relatedProducts` (currently `unknown[]`, Phase 13S) finally be typed as `StorefrontProductSummary[]` instead of staying opaque.

---

## Verification performed

- `npx tsc --noEmit -p tsconfig.json` — no new errors from this phase's changes (the one pre-existing, unrelated `ArchiveBlock` error remains, confirmed unrelated to any file this phase touched).
- `npx vitest run` — full suite: **464 tests passed across 58 files**, including the 11 new `tests/mediaResourceViewModel.test.ts` tests and all previously existing Media/Cart/Hero/adapter-boundary tests.

============================================================
STOP CONDITION ACKNOWLEDGED
============================================================
Stopping here per the Phase 13V brief. Payload and Stripe are both untouched; no production cutover was started. Awaiting explicit approval before any further Payload removal, Stripe removal, or production cutover work.
