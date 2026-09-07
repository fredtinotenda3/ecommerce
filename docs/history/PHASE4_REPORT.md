# PHASE 4 IMPLEMENTATION REPORT

## Pages/Endpoints Integrated
- `src/app/(pages)/products/page.tsx` — the Product **listing** page (`/products`). This route fetches a single CMS `Page` document (`slug: 'products'`) whose `layout` drives the intro/archive-intro content shown above the product grid, plus the full `categories` list used by `Filters`. It now branches on `isNativeRepositoryEnabled()`:
  - Native ON: `page` is fetched via `fetchPageNative('products', isDraftMode ? undefined : 'published')` (Phase 3), `categories` via `fetchCategoriesNative()` (Phase 2, already wired here before Phase 4).
  - Native OFF (default): unchanged — `fetchDoc<Page>({ collection: 'pages', slug: 'products', draft: isDraftMode })` and `fetchDocs<Category>('categories')`.
  - No new repositories, adapters, or fetch helpers were needed: `fetchPageNative` already resolves every block type this page renders (`archive`'s `populatedDocs`, `cta`, `content`, `mediaBlock`, `relatedProducts` pass-through) via the Phase 3 `layoutRelationsAdapter`, since `Page.layout` is shared/generic across routes.

This was the only remaining safe, server-rendered candidate. See below for why the actual product grid itself was inspected and intentionally left untouched.

## Candidates Inspected but Skipped

### `CollectionArchive`'s live product grid (`/api/products` REST calls)
- `ArchiveBlock` → `CollectionArchive` (`src/app/_components/CollectionArchive/index.tsx`) is a **client component** (`'use client'`) that fetches `${NEXT_PUBLIC_SERVER_URL}/api/${relationTo}` directly with `qs`-encoded `where`/`sort`/`page`/`limit` query params, driven by the `Filter` provider (category checkboxes + sort dropdown) and pagination state.
- This `/api/products` route is **not** a Next.js route under `src/app/api/**` — it's Payload's own built-in REST API, mounted by Payload's Express middleware in `src/server.ts` (confirmed: no `src/app/api/products/route.ts` exists; only `preview`, `exit-preview`, and `revalidate` are custom Next routes). Payload's REST layer is shared infrastructure — the same collection routing also backs the admin UI and other REST consumers.
- Per the task's explicit constraint ("Do NOT alter client-side pagination/filter behavior. If the page uses client-side REST, only add a native path if you can do so without changing the current client logic"): replacing what this client fetch talks to would mean either (a) changing the client's fetch target/logic (out of scope — this is exactly the "client-side pagination/filter path" the task says not to touch), or (b) intercepting/duplicating Payload's own `/api/products` REST route outside of `src/app`, which risks touching shared Payload REST routing behavior used elsewhere and goes beyond "flag-gated Server Component branching" into modifying how Payload's collections are served over HTTP.
- **Decision: skipped.** Flagged for explicit sign-off as a distinct future slice (a dedicated native `/api/products`-shaped Next.js route the client could point at instead, only after an explicit decision to change the client's fetch target) — consistent with the Phase 3 report's own "Recommended Phase 4" note, which called this out as needing separate approval before doing it.

### Dedicated category/archive listing routes
- Inspected all routes under `src/app/(pages)/**`. There is no separate "category archive" page (e.g. `/products/category/[slug]`) — category filtering on the storefront happens entirely client-side within `CollectionArchive` via the `Filter` provider against the same `/api/products` endpoint above. So there was no additional archive/category page-level candidate beyond the one already covered.

### `products/[slug]` and `[slug]` static-params (`generateStaticParams`)
- Both routes' `generateStaticParams` still call `fetchDocs<Page>('pages')` / `fetchDocs<ProductType>('products')` directly (GraphQL, unconditionally, no flag branch) — this was already true before Phase 3 and left as-is there too. It's a build-time-only path (not part of the public runtime read path this task targets), so it was left untouched again in Phase 4 for consistency with the established precedent.

### `RelatedProducts` block
- Already fully covered by Phase 3's `fetchProductNative` (its `docs` are resolved server-side via `layoutRelationsAdapter`'s archive/product resolution). No further action needed; re-inspected only to confirm no gap.

## Missing Fields/Models Discovered
None. Every field the products listing page and its rendered blocks read (`page.layout`, `page.hero`, `page.meta`, `Category.title`/`slug`/`media`) was already present in the domain model and native adapters from Phase 2/3. No new repository fields, Mongoose model fields, or adapter changes were required.

## Files Created
None.

## Files Modified
- `src/app/(pages)/products/page.tsx` — branch `page` fetch on `isNativeRepositoryEnabled()` between `fetchPageNative('products', ...)` and the existing `fetchDoc<Page>(...)` call. The `categories` fetch was already flag-gated (Phase 2) and is unchanged.

## Files Deleted
None.

## New Dependencies
None.

## Data-Fetch Approach Used
No new orchestration was needed — Phase 4 is purely a new **call site** for the existing Phase 3 `fetchPageNative` orchestration function (and the existing Phase 2 `fetchCategoriesNative`), applied to the one remaining un-migrated server-rendered `fetchDoc` call. The live product grid remains entirely client-side REST against Payload's own API, unchanged, per the explicit "don't alter client-side pagination/filter behavior" constraint.

## Environment Flag
`USE_NATIVE_REPOSITORY=true` (unchanged — see `src/app/_api/dataSource.ts`). No new flags introduced.

## Validation Results
`node_modules` was not present at the start of this phase and was installed (`npm install --legacy-peer-deps`) before running validation.

- **lint** (`npm run lint`): **0 errors.**
- **typecheck** (`npx tsc --noEmit`): **2 errors — both pre-existing, both in `src/app`, identical to the Phase 3 baseline, unrelated to Phase 4**:
  - `src/app/_blocks/ArchiveBlock/index.tsx(40,9)` — `sort` prop passed to `CollectionArchive` doesn't exist on its `Props` type.
  - `src/app/_components/Categories/CategoryCard/index.tsx(15,35)` — `Cannot find name 'Media'` (missing import).
- **tests** (`npm run test`): **104/104 passing** (16 test files) — same count as the Phase 3 baseline. No new tests were added because Phase 4 introduced no new orchestration/adapter logic: `src/app/(pages)/products/page.tsx` now calls `fetchPageNative` and `fetchCategoriesNative`, both of which are already fully covered by `tests/fetchPageNative.test.ts` (native output shape matches what `Blocks`/`Filters` consume, incl. the `archive` block's `populatedDocs` resolution) and `tests/fetchCategoriesNative.test.ts`. Flag-off behavior (falling through to `fetchDoc`/`fetchDocs`) is exercised by `tests/dataSource.test.ts`, and the `products/page.tsx` branch mirrors the exact pattern already covered for `[slug]/page.tsx` in Phase 3. No write operations exist anywhere in this call path (read-only `getBySlug`/`list` repository methods only).

## Existing Payload/GraphQL status
Untouched. `fetchDoc`/`fetchDocs`, `_graphql/*.ts` query files, Payload collection configs, and Payload's own `/api/products` REST route are unmodified. GraphQL remains the default data path whenever the flag is unset.

## Existing Stripe/Checkout status
Untouched. No changes to `src/payload/stripe/*`, checkout routes, `CheckoutForm`, or pricing logic.

## Existing Auth status
Untouched. No changes to authentication, `useAuth`, or `User`-related repositories/models.

## Existing Admin status
Untouched. No native admin UI was built; Payload's admin remains the only write path.

## Remaining Risks
- **The live product grid on `/products` (and any archive block with `populateBy: 'collection'` elsewhere) still reads through Payload's REST API regardless of the flag.** This is intentional per this phase's scope, but it means "native mode" is not yet end-to-end for that page — only the CMS wrapper content (intro text, hero, categories list) is native; the actual paginated/filtered product results are not. This is the natural Phase 5 candidate (see below).
- Same draft/versioning and unresolved-field caveats already documented in the Phase 3 report apply unchanged, since no adapter code was touched in Phase 4.

## Recommended Phase 5
Per the stated stop condition, wait for explicit approval. When approved, the highest-value next slice remains what Phase 3 already flagged: deciding whether/how to give `CollectionArchive`'s client-side fetch a native-backed equivalent (e.g., a dedicated Next.js `/app/api/products-native` read route the client could optionally call, or a server-side-rendered-then-hydrated grid) — without altering today's filter/pagination UX — followed by resolving `archive.categories`/`archive.selectedDocs` fully if a future component starts reading them. Both remain explicitly out of scope until separately approved.
