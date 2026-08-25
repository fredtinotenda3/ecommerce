# PHASE 3 IMPLEMENTATION REPORT

## Pages/Components Integrated
- `src/app/(pages)/products/[slug]/page.tsx` — Product detail page (default export + `generateMetadata`) now branches on `isNativeRepositoryEnabled()`. GraphQL (`fetchDoc`) remains the default; native path calls `fetchProductNative`.
- `src/app/(pages)/[slug]/page.tsx` — CMS Page route (default export + `generateMetadata`) branches the same way, calling `fetchPageNative` when the flag is on. The existing `Categories` branch (Phase 2) is untouched.
- Downstream render components exercised by the native path without modification: `ProductHero`, `Price`, `AddToCartButton`, `Blocks`, `CallToActionBlock`, `ContentBlock`, `MediaBlock`, `ArchiveBlock` → `CollectionArchive` → `Card`, `RelatedProducts`, `Hero` → `HighImpactHero`/`MediumImpactHero`/`LowImpactHero`/`CustomHero`, `CMSLink`, `Media`, `RichText`.
- `PaywallBlocks` is intentionally **not** touched — it does its own client-side `fetch` directly against `/api/graphql` (see its source), independent of `fetchDoc`/the native path, and is out of scope per the task's "DO NOT... implement Paynow" / checkout boundary and the Phase 3 focus on the primary server-rendered fetch only.

## Missing Fields Added

### Product fields added
- `layout: unknown[]` — block-based layout for the Product detail page (`cta`/`content`/`mediaBlock`/`archive`), same "untyped, CMS/render-layer-owned" treatment already used for `Page.layout`.
- `meta: { title?, description?, imageId }` — needed by `ProductHero` (description, image) and `generateMeta` (title/description/image).
- `ProductRepository.getBySlug` gained an optional `status` param (mirroring `PageRepository.getBySlug`), so the native fetch can distinguish "published only" (matches `fetchDoc`'s `draft: false`) from "any status" (matches `draft: true`).

### Page fields added
- None to the `Page` domain type itself — `layout`, `hero`, and `meta` already existed from earlier phases. What was missing was **resolution of the relational references embedded inside** `layout`/`hero` (media, page-link references, archive product references), which the raw Mongo read returns as bare ObjectIds rather than the populated docs GraphQL returns. This is addressed by the new `layoutRelationsAdapter.ts`, not by the domain type.

### Shared/supporting fields added (used by both Product and Page)
- `Media.caption: unknown` — required by `MediaBlock` and `HighImpactHero`, which read `media.caption` to render an optional caption under an image. Added to the domain `Media` type, `Media.ts` Mongoose model, and `MediaRepository.toDomain`.

### Fields intentionally NOT added
- **Category `breadcrumbs`** — present in the `PRODUCT_CATEGORIES` GraphQL fragment, but `ProductHero` only ever reads `category.title`; `breadcrumbs` is never rendered on the Product detail page. Native `categories` resolution only populates `id`/`title`.
- **`archive.categories`** — `ArchiveBlock` passes it through to `CollectionArchive`, but `CollectionArchive`'s implementation never destructures/reads that prop (category filtering there goes through the `Filter` provider + a client-side REST call instead). Left as raw, unresolved IDs.
- **`archive.selectedDocs`** — declared on the GraphQL type but `ArchiveBlock` never forwards it to `CollectionArchive` at all (dead for rendering purposes). Left unresolved.
- **`stripeProductID` on referenced/related products** — `Card` (the only renderer of a referenced product) never reads it; only `priceJSON` matters for display.
- **Recursive `layout` resolution for referenced products** — `Archive.populatedDocs[].value` and `relatedProducts[]` are mapped to a narrow shape (`buildMinimalStorefrontProduct`: id, slug, title, priceJSON, meta) and never recurse into their own `layout`/`categories`, since a referenced product is never rendered as a full detail page at that call site, and recursing risks unbounded fan-out (archive → product → relatedProducts → archive...).
- **Full Payload draft-versioning semantics** — the native `getBySlug(slug, status)` filters the same `products`/`pages` collection Payload writes to (matching the precedent already set by Phase 2's `PageRepository`), rather than reading Payload's separate `_products_versions`/`_pages_versions` collections. This is a deliberate, documented simplification, not a full re-implementation of Payload's versioning plugin.

## Files Created
- `src/lib/repositories/adapters/mediaStorefrontAdapter.ts`
- `src/lib/repositories/adapters/minimalProductAdapter.ts`
- `src/lib/repositories/adapters/layoutRelationsAdapter.ts`
- `src/lib/repositories/adapters/productStorefrontAdapter.ts`
- `src/lib/repositories/adapters/pageStorefrontAdapter.ts`
- `src/app/_api/fetchProductNative.ts`
- `src/app/_api/fetchPageNative.ts`
- `tests/fakes/FakePageRepository.ts`
- `tests/productStorefrontAdapter.test.ts`
- `tests/pageStorefrontAdapter.test.ts`
- `tests/layoutRelationsAdapter.test.ts`
- `tests/fetchProductNative.test.ts`
- `tests/fetchPageNative.test.ts`

## Files Modified
- `src/lib/domain/types.ts` — `Product.layout`, `Product.meta`, `Media.caption`.
- `src/lib/db/models/Product.ts` — declared `layout`/`meta` (Mixed passthrough).
- `src/lib/db/models/Media.ts` — declared `caption` (Mixed passthrough).
- `src/lib/repositories/ProductRepository.ts` — `toDomain` maps `layout`/`meta`; `getBySlug` gained optional `status`.
- `src/lib/repositories/MediaRepository.ts` — `toDomain` maps `caption`.
- `src/app/(pages)/products/[slug]/page.tsx` — branch on native flag.
- `src/app/(pages)/[slug]/page.tsx` — branch on native flag.
- `tests/fakes/FakeProductRepository.ts` — `getBySlug` status filter, `buildTestProduct` includes `layout`/`meta`.
- `tests/fakes/FakeMediaRepository.ts` — `buildTestMedia` includes `caption`.

## Files Deleted
None.

## New Dependencies
None.

## Data-Fetch Approach Used
Same orchestration/adapter split established in Phase 2:
- **Pure adapters** (`mediaStorefrontAdapter`, `minimalProductAdapter`, `productStorefrontAdapter`, `pageStorefrontAdapter`) do no I/O — they map already-resolved native records onto the exact Payload-typed shape the components expect.
- **`layoutRelationsAdapter.ts`** is the one deliberate deviation from "pure adapter": resolving relationships embedded inside a raw block tree (media refs, page-link refs, archive product refs) is inherently I/O-bound and shared by both collections, so it takes repository *interfaces* (not concrete Mongo classes) — same testability discipline as Phase 2's `buildStorefrontCategories`.
- **`fetchProductNative.ts` / `fetchPageNative.ts`** are the orchestration layer: each exports a DB-wired `fetchXNative(slug, status?)` plus a repository-interface-taking `buildStorefrontX(slug, deps, status?)` for unit testing without a database.
- Both new page routes call these only when `isNativeRepositoryEnabled()` is true; GraphQL (`fetchDoc`) remains the default and is completely untouched.

## Environment Flag
`USE_NATIVE_REPOSITORY=true` (unchanged from Phase 2 — see `src/app/_api/dataSource.ts`). No new flags introduced.

## Validation Results
`node_modules` was not present at the start of this phase, so it was installed (`npm install --legacy-peer-deps`) before running validation, per the task's instruction to run validation if node_modules is available (it became available) or otherwise state what was skipped. Nothing was skipped — all three commands ran.

- **lint** (`npm run lint`): **0 errors.**
- **typecheck** (`npx tsc --noEmit`): **2 errors — both pre-existing, both in `src/app`, unrelated to Phase 3**:
  - `src/app/_blocks/ArchiveBlock/index.tsx(40,9)` — `sort` prop passed to `CollectionArchive` doesn't exist on its `Props` type.
  - `src/app/_components/Categories/CategoryCard/index.tsx(15,35)` — `Cannot find name 'Media'` (missing import).
  These match the "only 2 pre-existing src/app errors" baseline stated in the task; no new typecheck errors were introduced.
- **tests** (`npm run test`): **104/104 passing** (16 test files) — the pre-existing 77 tests plus 27 new Phase 3 tests across `layoutRelationsAdapter`, `productStorefrontAdapter`, `pageStorefrontAdapter`, `fetchProductNative`, and `fetchPageNative`. Tests explicitly cover:
  - Native Product output shape matches what `ProductHero`/`Price`/`AddToCartButton`/`Card` consume.
  - Native Page output shape matches what the CMS `Blocks` renderer consumes.
  - Flag-off behavior is unchanged (`tests/dataSource.test.ts`, untouched, still passes; both page routes fall through to `fetchDoc` unless the flag is explicitly `'true'`).
  - The native path never falls back to native `price`/`currency` to synthesize `priceJSON` (and vice versa) — see `productStorefrontAdapter.test.ts`'s "never falls back..." test and `fetchProductNative.test.ts`'s equivalent orchestration-level test.

## Existing Payload/GraphQL status
Untouched. `fetchDoc`/`fetchDocs`, all `_graphql/*.ts` query files, and Payload collection configs were not modified. GraphQL remains the default data path everywhere the flag is unset.

## Existing Stripe/Checkout status
Untouched. No changes to `src/payload/stripe/*`, checkout routes, `CheckoutForm`, or `Price`'s legacy `priceJSON` parsing logic.

## Existing Auth status
Untouched. No changes to authentication, `useAuth`, or `User`-related repositories/models beyond what Phase 1/2 already established.

## Existing Admin status
Untouched. No native admin UI was built; Payload's admin remains the only write path.

## Remaining Risks
- **Draft/versioning parity is approximate, not exact.** The native path filters `_status` on the primary collection rather than reading Payload's dedicated versions collections, so a very recently-saved draft that hasn't been reflected on the main document (depending on Payload's internal versioning writes) could differ subtly from what draft-mode GraphQL shows. This mirrors an existing, already-accepted Phase 2 limitation on `PageRepository`.
- **`archive.categories` and `archive.selectedDocs` are left unresolved (raw IDs).** If a future component change starts actually reading either of these from `CollectionArchive`/`ArchiveBlock`, the native path will silently under-populate them until a follow-up phase resolves them.
- **Unbounded-depth block trees are only resolved one level deep for archive references** (referenced products never recurse into their own `layout`). This matches today's actual rendering needs, but should be revisited if a future design ever nests an archive block's referenced product's own archive block into the initial render.
- **`layoutRelationsAdapter.ts` resolves relations across blocks/entries in parallel via `Promise.all`, but each individual link/media lookup is awaited sequentially within its own resolver.** For a page/product with very large layouts this could be slower than GraphQL's single resolved response; no caching layer was added in this phase.

## Recommended Phase 4
Wait for explicit approval before proceeding, per the stated stop condition. When approved, a reasonable next slice would be: (a) resolving `archive.categories`/`selectedDocs` fully if any future component starts reading them, and (b) extending the same native read path to the Products *listing* page's `CollectionArchive` REST endpoint (`/api/products`) if a decision is made to widen native reads beyond single-doc fetches — but only after separate, explicit sign-off, since that endpoint currently drives client-side pagination/filtering behavior not touched in Phase 3.
