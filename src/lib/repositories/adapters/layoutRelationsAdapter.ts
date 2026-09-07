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
//
// ---------------------------------------------------------------------
// PHASE 13J — real parsing/validation against the native CMS types
// ---------------------------------------------------------------------
//
// Added in this phase: the walk below is now driven by structural type
// guards against `NativeLayoutBlock`/`NativeHero`/`NativeCMSLink`
// (src/lib/domain/types.ts, added in Phase 13I) instead of a bare
// `block.blockType === '...'` string comparison with no shape checking
// at all. See the "PHASE 13J — structural validation" section below for
// the guards themselves and why they're deliberately permissive rather
// than a strict schema validator.
//
// UNCHANGED by this phase, on purpose (per the phase's own scope):
//   - The EXTERNAL return shape of `resolveStorefrontLayout` /
//     `resolveStorefrontHero` — still `unknown[]` / `RawBlock | null`. The
//     caller (`pageStorefrontAdapter.ts`, `productStorefrontAdapter.ts`)
//     now casts the result to a `StorefrontPage`/`StorefrontProductDetail`
//     field type (`src/app/_types/storefront.ts`) instead of a
//     `payload-types.ts` one — see PHASE 13S below and each of those two
//     files' own comments.
//   - Every *resolved* field's actual content for well-formed input
//     (media/link/archive resolution logic is behaviorally identical to
//     before this phase — see tests/layoutRelationsAdapter.test.ts,
//     entirely unchanged from before this phase, still passing).
//   - `archive.categories`/`archive.selectedDocs` remain unresolved (Phase
//     3's documented scope limit — see the file header above and
//     docs/native-cms-layout-plan.md §3.6).
//
// ---------------------------------------------------------------------
// PHASE 13S — drop the `payload-types.ts` import from this file
// ---------------------------------------------------------------------
//
// Before this phase, `resolveMediaField`'s return type and
// `resolveArchivePopulatedDocs`'s resolved `value` field were annotated/cast
// against `payload-types.ts`'s `Media`/`Product` (`PayloadMedia`/
// `PayloadProduct`), even though neither annotation was load-bearing:
// `toStorefrontMedia`/`buildMinimalStorefrontProduct` (this file's own
// callees) already produce a value structurally compatible with those
// types without any cast. `resolveMediaField` now returns the dedicated
// `StorefrontMediaItem` view model (`src/app/_types/storefront.ts`) instead
// — every value `toStorefrontMedia` produces still satisfies it unchanged
// — and the `as PayloadProduct` in `resolveArchivePopulatedDocs` is simply
// removed (the surrounding `RawBlock`'s `value: any` accepted it either
// way). This drops the `Media as PayloadMedia`/`Product as PayloadProduct`
// import entirely; nothing about either function's runtime behavior
// changes — see tests/layoutRelationsAdapter.test.ts, unchanged and still
// passing.

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
// PHASE 13J — structural validation
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
    // PHASE 13J — "fail safely": one malformed/unresolvable block (e.g. a
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
