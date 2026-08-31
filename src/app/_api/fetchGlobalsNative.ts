// src/app/_api/fetchGlobalsNative.ts
//
// PHASE 13D — flag-gated, read-only parallel data path for the Header,
// Footer, and Settings globals.
//
// Mirrors `fetchHeader`/`fetchFooter`/`fetchSettings` (see ./fetchGlobals.ts
// and ../_graphql/globals.ts) but reads through the native
// MongoGlobalsRepository / MongoPageRepository / MongoMediaRepository
// instead of Payload's GraphQL API. Only used when `USE_NATIVE_REPOSITORY`
// is enabled (see ./dataSource.ts) — the GraphQL path remains the default.
//
// This performs READS ONLY. It must never be used for create/update/delete.
import { getDbConnection } from '../../lib/db/connection'
import type { NavItem } from '../../lib/domain/types'
import {
  type ResolvedNavRelations,
  toStorefrontFooter,
  toStorefrontHeader,
  toStorefrontSettings,
} from '../../lib/repositories/adapters/globalsStorefrontAdapter'
import type { GlobalsRepository } from '../../lib/repositories/GlobalsRepository'
import { MongoGlobalsRepository } from '../../lib/repositories/GlobalsRepository'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import { MongoPageRepository } from '../../lib/repositories/PageRepository'
import type {
  Footer as PayloadFooter,
  Header as PayloadHeader,
  Settings as PayloadSettings,
} from '../../payload/payload-types'

/** Orchestration only — takes repository interfaces (not concrete Mongo
 * classes) so it can be unit tested with the existing fake-repository
 * pattern (see tests/fakes) without a database. All DB wiring lives in the
 * `fetch*Native` functions below. */
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

/** Native equivalent of `fetchHeader`. Returns `null` (matching the
 * existing `header: Header | null` fallback in
 * src/app/_components/Header/index.tsx) when no Header global has been
 * created yet, rather than throwing — this is a normal, expected state for
 * a fresh database, not an error. */
export const buildStorefrontHeader = async (
  globalsRepository: GlobalsRepository,
  pageRepository: PageRepository,
  mediaRepository: MediaRepository,
): Promise<PayloadHeader | null> => {
  const header = await globalsRepository.getHeader()
  if (!header) return null
  const resolved = await resolveNavRelations(header.navItems, pageRepository, mediaRepository)
  return toStorefrontHeader(header, resolved)
}

/** Native equivalent of `fetchFooter`. See `buildStorefrontHeader` above
 * for the `null`-is-not-an-error rationale. */
export const buildStorefrontFooter = async (
  globalsRepository: GlobalsRepository,
  pageRepository: PageRepository,
  mediaRepository: MediaRepository,
): Promise<PayloadFooter | null> => {
  const footer = await globalsRepository.getFooter()
  if (!footer) return null
  const resolved = await resolveNavRelations(footer.navItems, pageRepository, mediaRepository)
  return toStorefrontFooter(footer, resolved)
}

/** Native equivalent of `fetchSettings`. See `buildStorefrontHeader` above
 * for the `null`-is-not-an-error rationale. */
export const buildStorefrontSettings = async (
  globalsRepository: GlobalsRepository,
  pageRepository: PageRepository,
): Promise<PayloadSettings | null> => {
  const settings = await globalsRepository.getSettings()
  if (!settings) return null

  let productsPageSlug: string | null = null
  if (settings.productsPageId) {
    const page = await pageRepository.getById(settings.productsPageId)
    productsPageSlug = page?.slug ?? null
  }

  return toStorefrontSettings(settings, productsPageSlug)
}

export const fetchHeaderNative = async (): Promise<PayloadHeader | null> => {
  const connection = await getDbConnection()
  return buildStorefrontHeader(
    new MongoGlobalsRepository(connection),
    new MongoPageRepository(connection),
    new MongoMediaRepository(connection),
  )
}

export const fetchFooterNative = async (): Promise<PayloadFooter | null> => {
  const connection = await getDbConnection()
  return buildStorefrontFooter(
    new MongoGlobalsRepository(connection),
    new MongoPageRepository(connection),
    new MongoMediaRepository(connection),
  )
}

export const fetchSettingsNative = async (): Promise<PayloadSettings | null> => {
  const connection = await getDbConnection()
  return buildStorefrontSettings(
    new MongoGlobalsRepository(connection),
    new MongoPageRepository(connection),
  )
}

/** Native equivalent of `fetchGlobals` — fetches all three in parallel over
 * a single shared connection, matching the GraphQL path's `Promise.all`
 * shape (see ./fetchGlobals.ts). */
export const fetchGlobalsNative = async (): Promise<{
  settings: PayloadSettings | null
  header: PayloadHeader | null
  footer: PayloadFooter | null
}> => {
  const connection = await getDbConnection()
  const globalsRepository = new MongoGlobalsRepository(connection)
  const pageRepository = new MongoPageRepository(connection)
  const mediaRepository = new MongoMediaRepository(connection)

  const [settings, header, footer] = await Promise.all([
    buildStorefrontSettings(globalsRepository, pageRepository),
    buildStorefrontHeader(globalsRepository, pageRepository, mediaRepository),
    buildStorefrontFooter(globalsRepository, pageRepository, mediaRepository),
  ])

  return { settings, header, footer }
}
