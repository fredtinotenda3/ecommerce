// src/app/_api/fetchPage.ts
//
// Read-only page reads for the CMS-driven storefront routes. Resolves the
// page's hero and layout relations, then maps the result onto the
// `StorefrontPage` view model.

import {
  resolveStorefrontHero,
  resolveStorefrontLayout,
} from '../../lib/repositories/adapters/layoutRelationsAdapter'
import { toStorefrontPage } from '../../lib/repositories/adapters/pageStorefrontAdapter'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import type { StorefrontPage } from '../_types/storefront'
import { getRepositories } from './repositories'

export interface PageDeps {
  pageRepository: PageRepository
  mediaRepository: MediaRepository
  /** Only needed when a page's layout contains an `archive` block with
   * `populatedDocs`. */
  productRepository?: ProductRepository
}

/** Orchestration only — takes repository interfaces so it can be unit
 * tested with fakes. All connection wiring lives in `fetchPage` below.
 *
 * `status` is `undefined` for draft mode ("latest version regardless of
 * status") and `'published'` otherwise. */
export const buildStorefrontPage = async (
  slug: string,
  deps: PageDeps,
  status?: 'draft' | 'published',
): Promise<StorefrontPage | null> => {
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

export const fetchPage = async (
  slug: string,
  status?: 'draft' | 'published',
): Promise<StorefrontPage | null> => {
  const { pages, media, products } = await getRepositories()

  return buildStorefrontPage(
    slug,
    { pageRepository: pages, mediaRepository: media, productRepository: products },
    status,
  )
}

/** Slugs for `generateStaticParams`. Published pages only. */
export const fetchPageSlugs = async (): Promise<string[]> => {
  const { pages } = await getRepositories()
  const all = await pages.list('published')
  return all.map(page => page.slug)
}
