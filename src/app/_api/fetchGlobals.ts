// src/app/_api/fetchGlobals.ts
//
// Read-only reads for the Header, Footer and Settings globals, with nav
// item relations (referenced page -> slug, icon media -> url) resolved.

import type { NavItem } from '../../lib/domain/types'
import {
  type ResolvedNavRelations,
  toStorefrontFooter,
  toStorefrontHeader,
  toStorefrontSettings,
} from '../../lib/repositories/adapters/globalsStorefrontAdapter'
import type { GlobalsRepository } from '../../lib/repositories/GlobalsRepository'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import type {
  StorefrontFooter,
  StorefrontHeader,
  StorefrontSettingsLike,
} from '../_types/storefront'
import { getRepositories } from './repositories'

/** Orchestration only — takes repository interfaces so it can be unit
 * tested with fakes. */
const resolveNavRelations = async (
  navItems: NavItem[],
  pageRepository: PageRepository,
  mediaRepository: MediaRepository,
): Promise<ResolvedNavRelations> => {
  const pageIds = new Set<string>()
  const mediaIds = new Set<string>()

  for (const item of navItems) {
    if (item.link.referencePageId) pageIds.add(item.link.referencePageId)
    if (item.link.iconMediaId) mediaIds.add(item.link.iconMediaId)
  }

  const pageSlugsById = new Map<string, string>()
  await Promise.all(
    Array.from(pageIds).map(async id => {
      const page = await pageRepository.getById(id)
      if (page) pageSlugsById.set(id, page.slug)
    }),
  )

  const mediaUrlsById = new Map<string, string | null>()
  await Promise.all(
    Array.from(mediaIds).map(async id => {
      const media = await mediaRepository.getById(id)
      mediaUrlsById.set(id, media?.url ?? null)
    }),
  )

  return { pageSlugsById, mediaUrlsById }
}

/** Returns `null` when the global has not been created yet. That is a
 * normal state for a fresh database, not an error, and every consumer
 * already renders a fallback for it. */
export const buildStorefrontHeader = async (
  globalsRepository: GlobalsRepository,
  pageRepository: PageRepository,
  mediaRepository: MediaRepository,
): Promise<StorefrontHeader | null> => {
  const header = await globalsRepository.getHeader()
  if (!header) return null
  const resolved = await resolveNavRelations(header.navItems, pageRepository, mediaRepository)
  return toStorefrontHeader(header, resolved)
}

/** See `buildStorefrontHeader` for the null-is-not-an-error rationale. */
export const buildStorefrontFooter = async (
  globalsRepository: GlobalsRepository,
  pageRepository: PageRepository,
  mediaRepository: MediaRepository,
): Promise<StorefrontFooter | null> => {
  const footer = await globalsRepository.getFooter()
  if (!footer) return null
  const resolved = await resolveNavRelations(footer.navItems, pageRepository, mediaRepository)
  return toStorefrontFooter(footer, resolved)
}

/** See `buildStorefrontHeader` for the null-is-not-an-error rationale. */
export const buildStorefrontSettings = async (
  globalsRepository: GlobalsRepository,
  pageRepository: PageRepository,
): Promise<StorefrontSettingsLike | null> => {
  const settings = await globalsRepository.getSettings()
  if (!settings) return null

  let productsPageSlug: string | null = null
  if (settings.productsPageId) {
    const page = await pageRepository.getById(settings.productsPageId)
    productsPageSlug = page?.slug ?? null
  }

  return toStorefrontSettings(settings, productsPageSlug)
}

export const fetchHeader = async (): Promise<StorefrontHeader | null> => {
  const { globals, pages, media } = await getRepositories()
  return buildStorefrontHeader(globals, pages, media)
}

export const fetchFooter = async (): Promise<StorefrontFooter | null> => {
  const { globals, pages, media } = await getRepositories()
  return buildStorefrontFooter(globals, pages, media)
}

export const fetchSettings = async (): Promise<StorefrontSettingsLike | null> => {
  const { globals, pages } = await getRepositories()
  return buildStorefrontSettings(globals, pages)
}

/** All three over a single shared connection. */
export const fetchGlobals = async (): Promise<{
  settings: StorefrontSettingsLike | null
  header: StorefrontHeader | null
  footer: StorefrontFooter | null
}> => {
  const { globals, pages, media } = await getRepositories()

  const [settings, header, footer] = await Promise.all([
    buildStorefrontSettings(globals, pages),
    buildStorefrontHeader(globals, pages, media),
    buildStorefrontFooter(globals, pages, media),
  ])

  return { settings, header, footer }
}
