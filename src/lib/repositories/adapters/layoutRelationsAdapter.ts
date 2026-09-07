
import type { StorefrontMediaItem } from '../../../app/_types/storefront'
import type {
  Media as NativeMedia,
  NativeCMSLink,
  NativeHero,
  NativeLayoutBlock,
} from '../../domain/types'
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

// ---------------------------------------------------------------------
// structural validation
// ---------------------------------------------------------------------
//
// These guards/coercers give the raw-Mongo-document walk below real
// structural checks against `NativeLayoutBlock`/`NativeHero`/`NativeCMSLink`,
// replacing what was previously an implicit-trust string comparison.
// They are deliberately PERMISSIVE, not a strict schema validator: a
// stored block whose optional fields are missing or the wrong JS type is
// coerced to a safe default or passed through untouched rather than
// rejected — a stricter check here would mean legitimately-sparse stored
// data (e.g. a real `cta` block with no `links` at all) silently skips
// relation resolution, which would be WORSE than this file's pre-13J
// behavior, not better. A block whose `blockType` doesn't match any
// known `NativeLayoutBlock` member is passed straight through untouched,
// exactly as before this phase — this is intentionally the "unknown/
// future block type" escape hatch, not an error condition.

const isPlainObject = (value: unknown): value is RawBlock =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const NATIVE_LAYOUT_BLOCK_TYPES = ['cta', 'content', 'mediaBlock', 'archive'] as const
type NativeLayoutBlockType = NativeLayoutBlock['blockType']

/** Structural guard for "this raw value is at least shaped enough to
 * dispatch as a `NativeLayoutBlock`" — a plain object whose `blockType`
 * is one of the four known discriminant literals. See the section header
 * above for why this deliberately does not validate every field on the
 * corresponding native type up front. */
const isKnownLayoutBlockType = (
  block: RawBlock,
): block is RawBlock & { blockType: NativeLayoutBlockType } =>
  (NATIVE_LAYOUT_BLOCK_TYPES as readonly string[]).includes(block.blockType)

const NATIVE_HERO_TYPES = ['none', 'highImpact', 'mediumImpact', 'lowImpact', 'customHero'] as const

/** Soft validation only — logs for visibility if a stored hero's `type`
 * isn't one of `NativeHero`'s known literals, but (unlike the block
 * guard above) never changes `resolveStorefrontHero`'s return value based
 * on the result: `type` was never inspected or transformed by this file
 * before Phase 13J either, so changing that now would be new behavior,
 * not validation of existing behavior. */
const isKnownHeroType = (value: unknown): value is NativeHero['type'] =>
  (NATIVE_HERO_TYPES as readonly unknown[]).includes(value)

/** Type guard for a `NativeCMSLink` whose `reference` should actually be
 * resolved — mirrors the exact condition `resolveLink` branched on
 * before Phase 13J (`link.type !== 'reference' || !link.reference?.value`,
 * negated), now expressed as a real structural check against
 * `NativeCMSLink` instead of ad hoc optional chaining. A link that fails
 * this check is not "invalid" — it's a `type: 'custom'` link (or one with
 * no reference value yet), which was, and still is, passed through
 * unchanged. */
const isReferenceLink = (
  link: unknown,
): link is NativeCMSLink & {
  type: 'reference'
  reference: NonNullable<NativeCMSLink['reference']>
} =>
  isPlainObject(link) &&
  link.type === 'reference' &&
  isPlainObject(link.reference) &&
  Boolean(link.reference.value)

const resolveMediaField = async (
  value: unknown,
  mediaRepository: MediaRepository,
): Promise<StorefrontMediaItem | undefined> => {
  if (value == null) return undefined

  // Defensive: if something upstream already populated this to an
  // object shape, pass it through rather than trying to re-resolve it.
  if (isPlainObject(value) && 'mimeType' in value) {
    return value as StorefrontMediaItem
  }

  const id = idToString(value)
  if (!id) return undefined

  const media: NativeMedia | null = await mediaRepository.getById(id)
  return media ? toStorefrontMedia(media) : undefined
}

const resolveLink = async (
  link: unknown,
  pageRepository: PageRepository,
): Promise<RawBlock | undefined> => {
  if (!link) return link as undefined
  if (!isReferenceLink(link)) return link as RawBlock

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
  links: unknown,
  pageRepository: PageRepository,
): Promise<RawBlock[] | undefined> => {
  if (!Array.isArray(links)) return links as RawBlock[] | undefined
  return Promise.all(
    links.map(async entry => ({
      ...entry,
      link: await resolveLink(isPlainObject(entry) ? entry.link : undefined, pageRepository),
    })),
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
        value: buildMinimalStorefrontProduct(product, metaImage),
      }
    }),
  )
}

const resolveKnownBlock = async (
  block: RawBlock & { blockType: NativeLayoutBlockType },
  deps: LayoutResolutionDeps,
): Promise<RawBlock> => {
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
            link:
              isPlainObject(col) && col.enableLink
                ? await resolveLink(col.link, deps.pageRepository)
                : col?.link,
          })),
        ),
      }

    case 'archive':
      return {
        ...block,
        populatedDocs: await resolveArchivePopulatedDocs(block.populatedDocs, deps),
      }

    default:
      // Unreachable given `NativeLayoutBlockType`'s four members, kept
      // for exhaustiveness safety if that union ever grows without this
      // switch being updated to match.
      return block
  }
}

const resolveBlock = async (block: unknown, deps: LayoutResolutionDeps): Promise<unknown> => {
  if (!isPlainObject(block)) return block
  if (!isKnownLayoutBlockType(block)) return block

  try {
    return await resolveKnownBlock(block, deps)
  } catch (error: unknown) {
    // "fail safely": one malformed/unresolvable block (e.g. a
    // relation id that causes a repository lookup to throw) must not fail
    // resolution of the entire page/product layout. Log for visibility
    // and fall back to the untouched raw block — same outcome as the
    // "unknown blockType" branch above.
    // eslint-disable-next-line no-console
    console.error('layoutRelationsAdapter: failed to resolve block, passing through raw', {
      blockType: block.blockType,
      error,
    })
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
  return Promise.all(blocks.map(block => resolveBlock(block, deps)))
}

/** Resolves relational fields inside a raw `hero` object (Page only —
 * Product has no hero field in the domain model; `ProductHero` derives
 * its own display fields directly from `product.meta`/`categories`). */
export const resolveStorefrontHero = async (
  hero: unknown,
  deps: LayoutResolutionDeps,
): Promise<RawBlock | null> => {
  if (!isPlainObject(hero)) return null

  if (!isKnownHeroType(hero.type)) {
    // Soft validation only — see isKnownHeroType's comment. Does not
    // change the return value below.
    // eslint-disable-next-line no-console
    console.warn('layoutRelationsAdapter: hero has an unrecognized type', { type: hero.type })
  }

  try {
    return {
      ...hero,
      media: await resolveMediaField(hero.media, deps.mediaRepository),
      links: await resolveLinkGroup(hero.links, deps.pageRepository),
    }
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('layoutRelationsAdapter: failed to resolve hero, passing through raw', error)
    return hero
  }
}
