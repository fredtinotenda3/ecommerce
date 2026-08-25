// src/app/_api/fetchPageNative.ts
//
// PHASE 3 — flag-gated, read-only parallel data path.
//
// Mirrors `fetchDoc<Page>({ collection: 'pages', slug, draft })` (see
// ./fetchDoc.ts and ../_graphql/pages.ts) but reads through the native
// Mongo*Repository classes instead of Payload's GraphQL API. Only used
// when `USE_NATIVE_REPOSITORY=true`; the GraphQL path remains the
// default. See src/app/_api/dataSource.ts for the flag.
//
// This performs READS ONLY. It must never be used for create/update/delete.

import { getDbConnection } from '../../lib/db/connection'
import {
  resolveStorefrontHero,
  resolveStorefrontLayout,
} from '../../lib/repositories/adapters/layoutRelationsAdapter'
import { toStorefrontPage } from '../../lib/repositories/adapters/pageStorefrontAdapter'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import { MongoPageRepository } from '../../lib/repositories/PageRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'
import type { Page as PayloadPage } from '../../payload/payload-types'

export interface PageNativeDeps {
  pageRepository: PageRepository
  mediaRepository: MediaRepository
  /** Only needed if a Page's layout ever contains an `archive` block with
   * `populatedDocs` — wired in `fetchPageNative` below for parity with
   * `fetchProductNative`, since `Page.layout` shares the same `archive`
   * block type as `Product.layout` (see payload-types.ts). */
  productRepository?: ProductRepository
}

/** Orchestration only — takes repository INTERFACES (not concrete Mongo
 * classes) so it can be unit tested with the existing fake-repository
 * pattern (see tests/fakes) without a database. All DB wiring lives in
 * `fetchPageNative` below. Mirrors `buildStorefrontCategories`'s shape
 * from Phase 2 (see fetchCategoriesNative.ts). */
export const buildStorefrontPage = async (
  slug: string,
  deps: PageNativeDeps,
  status?: 'draft' | 'published',
): Promise<PayloadPage | null> => {
  const { pageRepository, mediaRepository, productRepository } = deps

  const page = await pageRepository.getBySlug(slug, status)
  if (!page) return null

  const metaImage = page.meta.imageId ? await mediaRepository.getById(page.meta.imageId) : null

  const layoutDeps = { mediaRepository, pageRepository, productRepository }

  const [hero, layout] = await Promise.all([
    resolveStorefrontHero(page.hero, layoutDeps),
    resolveStorefrontLayout(page.layout, layoutDeps),
  ])

  return toStorefrontPage(page, { hero, layout, metaImage })
}

/** Native equivalent of `fetchDoc<Page>({ collection: 'pages', slug,
 * draft })`. `status` should be `undefined` for draft mode's "latest
 * version regardless of status" behavior, and `'published'` otherwise —
 * see the callers in `src/app/(pages)/[slug]/page.tsx`. */
export const fetchPageNative = async (
  slug: string,
  status?: 'draft' | 'published',
): Promise<PayloadPage | null> => {
  const connection = await getDbConnection()

  return buildStorefrontPage(
    slug,
    {
      pageRepository: new MongoPageRepository(connection),
      mediaRepository: new MongoMediaRepository(connection),
      productRepository: new MongoProductRepository(connection),
    },
    status,
  )
}
