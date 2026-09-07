// src/app/_api/fetchCategories.ts
//
// Read-only category listing for the storefront (`Filters`, `Categories`,
// `CategoryCard`), with each category's media resolved.

import { toStorefrontCategory } from '../../lib/repositories/adapters/categoryStorefrontAdapter'
import type { CategoryRepository } from '../../lib/repositories/CategoryRepository'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import type { StorefrontCategory } from '../_types/storefront'
import { getRepositories } from './repositories'

/** Orchestration only — takes repository interfaces so it can be unit
 * tested with the fakes in `tests/fakes` without a database. */
export const buildStorefrontCategories = async (
  categoryRepository: CategoryRepository,
  mediaRepository: MediaRepository,
): Promise<StorefrontCategory[]> => {
  const categories = await categoryRepository.list()

  return Promise.all(
    categories.map(async category => {
      const media = category.mediaId ? await mediaRepository.getById(category.mediaId) : null
      return toStorefrontCategory(category, media)
    }),
  )
}

export const fetchCategories = async (): Promise<StorefrontCategory[]> => {
  const { categories, media } = await getRepositories()
  return buildStorefrontCategories(categories, media)
}
