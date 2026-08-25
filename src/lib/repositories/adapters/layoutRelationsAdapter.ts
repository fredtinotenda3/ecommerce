// src/lib/repositories/adapters/layoutRelationsAdapter.ts
//
// PHASE 3 — resolves the relational fields embedded INSIDE a raw
// `layout` block array or a `hero` object (both are stored as Mongoose
// `Mixed`/passthrough on Page.ts and Product.ts, so a `.lean()` read
// returns them largely as Payload originally wrote them: relationship
// fields are bare ObjectIds, not the populated docs the existing GraphQL
// path already resolves — see PRODUCT/PAGE queries' nested selections in
// src/app/_graphql/{blocks,pages,products}.ts).
//
// Block types `cta`, `content`, `mediaBlock`, and `archive` are shared
// verbatim between `Page.layout` and `Product.layout` (see
// payload-types.ts), and `hero` uses the same `media`/`links` shapes as
// `mediaBlock`/`cta` — so this one module is reused by both
// `fetchPageNative.ts` and `fetchProductNative.ts` rather than
// duplicating the resolution logic per collection.
//
// NOTE ON DEVIATION FROM THE "PURE ADAPTER" CONVENTION: unlike
// `categoryStorefrontAdapter.ts`/`mediaStorefrontAdapter.ts` (pure, no
// I/O), the functions here DO call repositories, because resolving a
// block tree's relationships is inherently a graph-walk that needs
// lookups at arbitrary depth. Like `fetchCategoriesNative.ts`'s
// `buildStorefrontCategories`, they take repository INTERFACES (not
// concrete Mongo classes), so they remain unit-testable with the
// existing fake-repository pattern without a database.
//
// This resolves ONLY the fields the current block components actually
// read (see Phase 3 report for the full list of what was intentionally
// left unresolved, e.g. `archive.categories`, `archive.selectedDocs` —
// neither is consumed by `CollectionArchive`/`ArchiveBlock` today).
//
// READS ONLY.

import type {
  Media as PayloadMedia,
  Product as PayloadProduct,
} from '../../../payload/payload-types'
import type { Media as NativeMedia } from '../../domain/types'
import type { MediaRepository } from '../MediaRepository'
import type { PageRepository } from '../PageRepository'
import type { ProductRepository } from '../ProductRepository'
import { toStorefrontMedia } from './mediaStorefrontAdapter'
import { buildMinimalStorefrontProduct } from './minimalProductAdapter'

export interface LayoutResolutionDeps {
  mediaRepository: MediaRepository
  pageRepository: PageRepository
  /** Only required to resolve `archive.populatedDocs[].value` product
   * references. Optional so callers that never render an archive block
   * (e.g. none, today) aren't forced to wire a ProductRepository. */
  productRepository?: ProductRepository
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBlock = Record<string, any>

const idToString = (value: unknown): string | null => {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (
    typeof value === 'object' &&
    typeof (value as { toString?: unknown }).toString === 'function'
  ) {
    const str = (value as { toString: () => string }).toString()
    // Guard against `[object Object]` from a plain object that isn't
    // actually an ObjectId-like value (e.g. an already-populated doc).
    return str === '[object Object]' ? null : str
  }
  return null
}

const resolveMediaField = async (
  value: unknown,
  mediaRepository: MediaRepository,
): Promise<PayloadMedia | undefined> => {
  if (value == null) return undefined

  // Defensive: if something upstream already populated this to an
  // object shape, pass it through rather than trying to re-resolve it.
  if (typeof value === 'object' && 'mimeType' in (value as RawBlock)) {
    return value as PayloadMedia
  }

  const id = idToString(value)
  if (!id) return undefined

  const media: NativeMedia | null = await mediaRepository.getById(id)
  return media ? toStorefrontMedia(media) : undefined
}

const resolveLink = async (
  link: RawBlock | undefined,
  pageRepository: PageRepository,
): Promise<RawBlock | undefined> => {
  if (!link) return link
  if (link.type !== 'reference' || !link.reference?.value) return link

  const id = idToString(link.reference.value)
  const page = id ? await pageRepository.getById(id) : null

  return {
    ...link,
    reference: {
      relationTo: link.reference.relationTo,
      // CMSLink only ever reads `reference.value.slug` — see
      // src/app/_components/Link/index.tsx.
      value: page ? { id: page.id, slug: page.slug } : link.reference.value,
    },
  }
}

const resolveLinkGroup = async (
  links: RawBlock[] | undefined,
  pageRepository: PageRepository,
): Promise<RawBlock[] | undefined> => {
  if (!Array.isArray(links)) return links
  return Promise.all(
    links.map(async entry => ({ ...entry, link: await resolveLink(entry.link, pageRepository) })),
  )
}

const resolveArchivePopulatedDocs = async (
  populatedDocs: RawBlock[] | undefined,
  deps: LayoutResolutionDeps,
): Promise<RawBlock[] | undefined> => {
  if (!Array.isArray(populatedDocs) || !deps.productRepository) return populatedDocs
  const { productRepository, mediaRepository } = deps

  return Promise.all(
    populatedDocs.map(async entry => {
      const id = idToString(entry?.value)
      if (!id) return entry

      const product = await productRepository.getById(id)
      if (!product) return entry

      const metaImage = product.meta.imageId
        ? await mediaRepository.getById(product.meta.imageId)
        : null

      return {
        relationTo: entry.relationTo,
        value: buildMinimalStorefrontProduct(product, metaImage) as PayloadProduct,
      }
    }),
  )
}

const resolveBlock = async (block: RawBlock, deps: LayoutResolutionDeps): Promise<RawBlock> => {
  if (!block || typeof block !== 'object') return block

  switch (block.blockType) {
    case 'mediaBlock':
      // Same convention as `categoryStorefrontAdapter.ts`'s Phase 2
      // `toStorefrontCategory`: an unresolvable reference maps to
      // `undefined` rather than leaking the raw, unresolved id string
      // downstream (Media/MediaBlock only render correctly given either
      // a full Media object or nothing).
      return {
        ...block,
        media: await resolveMediaField(block.media, deps.mediaRepository),
      }

    case 'cta':
      return {
        ...block,
        links: await resolveLinkGroup(block.links, deps.pageRepository),
      }

    case 'content':
      if (!Array.isArray(block.columns)) return block
      return {
        ...block,
        columns: await Promise.all(
          block.columns.map(async (col: RawBlock) => ({
            ...col,
            link: col.enableLink ? await resolveLink(col.link, deps.pageRepository) : col.link,
          })),
        ),
      }

    case 'archive':
      return {
        ...block,
        populatedDocs: await resolveArchivePopulatedDocs(block.populatedDocs, deps),
      }

    default:
      return block
  }
}

/** Resolves relational fields inside a raw `layout` array. Non-array or
 * empty input returns `[]`, matching `Page`/`Product` domain types'
 * `layout: unknown[]`. */
export const resolveStorefrontLayout = async (
  blocks: unknown[] | undefined,
  deps: LayoutResolutionDeps,
): Promise<unknown[]> => {
  if (!Array.isArray(blocks) || blocks.length === 0) return []
  return Promise.all(blocks.map(block => resolveBlock(block as RawBlock, deps)))
}

/** Resolves relational fields inside a raw `hero` object (Page only —
 * Product has no hero field in the domain model; `ProductHero` derives
 * its own display fields directly from `product.meta`/`categories`). */
export const resolveStorefrontHero = async (
  hero: unknown,
  deps: LayoutResolutionDeps,
): Promise<RawBlock | null> => {
  if (!hero || typeof hero !== 'object') return null
  const rawHero = hero as RawBlock

  return {
    ...rawHero,
    media: await resolveMediaField(rawHero.media, deps.mediaRepository),
    links: await resolveLinkGroup(rawHero.links, deps.pageRepository),
  }
}
