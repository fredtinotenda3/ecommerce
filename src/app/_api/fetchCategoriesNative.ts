// src/app/_api/fetchCategoriesNative.ts
//
// PHASE 2 — flag-gated, read-only parallel data path.
//
// Mirrors `fetchDocs<Category>('categories')` (see ./fetchDocs.ts and
// ../_graphql/categories.ts) but reads through the native
// MongoCategoryRepository / MongoMediaRepository instead of Payload's
// GraphQL API. Only used when `USE_NATIVE_REPOSITORY=true`; the GraphQL
// path remains the default. See src/app/_api/dataSource.ts for the flag.
//
// This performs READS ONLY. It must never be used for create/update/delete.

import { getDbConnection } from '../../lib/db/connection'
import { toStorefrontCategory } from '../../lib/repositories/adapters/categoryStorefrontAdapter'
import type { CategoryRepository } from '../../lib/repositories/CategoryRepository'
import { MongoCategoryRepository } from '../../lib/repositories/CategoryRepository'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import type { Category as PayloadCategory } from '../../payload/payload-types'

/** Orchestration only — takes repository interfaces (not concrete Mongo
 * classes) so it can be unit tested with the existing fake-repository
 * pattern (see tests/fakes) without a database. All DB wiring lives in
 * `fetchCategoriesNative` below. */
export const buildStorefrontCategories = async (
  categoryRepository: CategoryRepository,
  mediaRepository: MediaRepository,
): Promise<PayloadCategory[]> => {
  const categories = await categoryRepository.list()

  return Promise.all(
    categories.map(async category => {
      const media = category.mediaId ? await mediaRepository.getById(category.mediaId) : null
      return toStorefrontCategory(category, media)
    }),
  )
}

/** Native equivalent of `fetchDocs<Category>('categories')`. Returns the
 * same shape the storefront's `Filters` and `Categories`/`CategoryCard`
 * components already consume, with `media` populated (not just an id) to
 * match what the GraphQL `CATEGORIES` query returns today. */
export const fetchCategoriesNative = async (): Promise<PayloadCategory[]> => {
  const connection = await getDbConnection()
  const categoryRepository = new MongoCategoryRepository(connection)
  const mediaRepository = new MongoMediaRepository(connection)

  return buildStorefrontCategories(categoryRepository, mediaRepository)
}
