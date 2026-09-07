// tests/storefrontCmsMediaArchiveBlocks.test.ts
//
// PHASE 13R — type-level tests for the `StorefrontMediaLayoutBlock` /
// `StorefrontArchiveRelation` / `StorefrontArchiveBlock` view models added
// to src/app/_types/storefront.ts (derived from `NativeMediaLayoutBlock`/
// `NativeArchiveBlock` in src/lib/domain/types.ts). Same rationale as
// tests/storefrontCmsBlocks.test.ts (Phase 13L): these types have no
// runtime behavior of their own, so the main thing worth locking in is
// that a real `payload-types.ts` `Page['layout'][number]` (`mediaBlock` /
// `archive` variants) still satisfies each narrowed type unchanged, and
// that the `MediaBlock`/`ArchiveBlock` components themselves still accept
// real Payload-shaped block data unmodified. Each assignment below only
// type-checks if that stays true, so a future edit that breaks the
// relationship fails `npm run test`'s `tsc`-backed collection step the
// same as `npx tsc --noEmit` would.

import { describe, expect, it } from 'vitest'

import { MediaBlock } from '../src/app/_blocks/MediaBlock'
import type { ArchiveBlockProps } from '../src/app/_blocks/ArchiveBlock/types'
import type {
  StorefrontArchiveBlock,
  StorefrontArchiveRelation,
  StorefrontMediaLayoutBlock,
} from '../src/app/_types/storefront'
import type { Page as PayloadPage, Product as PayloadProduct } from '../src/payload/payload-types'

describe('StorefrontMediaLayoutBlock (Phase 13R)', () => {
  it('accepts a minimal mediaBlock with no invertBackground/position', () => {
    const block: StorefrontMediaLayoutBlock = {}
    expect(block.invertBackground).toBeUndefined()
    expect(block.position).toBeUndefined()
  })

  it('accepts a real payload-types.ts mediaBlock block unchanged (media handled separately)', () => {
    const payloadMediaBlock: Extract<PayloadPage['layout'][number], { blockType: 'mediaBlock' }> =
      {
        invertBackground: true,
        position: 'fullscreen',
        media: 'media-id-123',
        id: 'media-block-1',
        blockName: 'Hero media',
        blockType: 'mediaBlock',
      }

    // `media` is intentionally excluded from `StorefrontMediaLayoutBlock`
    // (see that type's doc comment) — `MediaBlock`'s own `Props` type
    // intersects it back in separately, so only the remaining fields are
    // checked against the shared view model here.
    const storefrontMediaBlock: StorefrontMediaLayoutBlock = payloadMediaBlock
    expect(storefrontMediaBlock.position).toBe('fullscreen')
    expect(storefrontMediaBlock.invertBackground).toBe(true)
    expect(storefrontMediaBlock.blockName).toBe('Hero media')
  })

  it('the MediaBlock component still accepts a real payload-types.ts mediaBlock prop', () => {
    // Type-level only: proves `MediaBlock`'s own declared `Props` type
    // (`StorefrontMediaLayoutBlock & { media: string | Media; ... }`) still
    // accepts a real Payload `mediaBlock` block unchanged.
    const props: Parameters<typeof MediaBlock>[0] = {
      invertBackground: false,
      position: 'default',
      media: 'media-id-123',
      id: 'media-block-1',
      blockName: 'Body media',
      blockType: 'mediaBlock',
    }
    expect(props.media).toBe('media-id-123')
  })
})

describe('StorefrontArchiveRelation / StorefrontArchiveBlock (Phase 13R)', () => {
  it('accepts a minimal archive block with only introContent', () => {
    const block: StorefrontArchiveBlock = { introContent: [{ type: 'h3' }] }
    expect(block.populatedDocs).toBeUndefined()
    expect(block.categories).toBeUndefined()
  })

  it('accepts an unresolved (string) populatedDocs entry', () => {
    const relation: StorefrontArchiveRelation = { relationTo: 'products', value: 'product-id-1' }
    expect(relation.value).toBe('product-id-1')
  })

  it('accepts a real payload-types.ts archive block with resolved Product docs and Category[] unchanged', () => {
    const now = new Date().toISOString()
    const payloadProduct: PayloadProduct = {
      id: 'prod-1',
      title: 'Test Product',
      updatedAt: now,
      createdAt: now,
    }

    const payloadArchive: Extract<PayloadPage['layout'][number], { blockType: 'archive' }> = {
      introContent: [{ type: 'h3', children: [{ text: 'Related Products' }] }],
      populateBy: 'selection',
      relationTo: 'products',
      categories: [
        {
          id: 'cat-1',
          title: 'Widgets',
          updatedAt: now,
          createdAt: now,
        },
      ],
      limit: 10,
      populatedDocs: [{ relationTo: 'products', value: payloadProduct }],
      populatedDocsTotal: 1,
      id: 'archive-1',
      blockName: 'Related',
      blockType: 'archive',
    }

    const storefrontArchive: StorefrontArchiveBlock = payloadArchive
    expect(storefrontArchive.populatedDocsTotal).toBe(1)
    expect(storefrontArchive.categories?.[0]).toMatchObject({ id: 'cat-1', title: 'Widgets' })
    const resolvedDoc = storefrontArchive.populatedDocs?.[0].value
    expect(typeof resolvedDoc === 'object' && resolvedDoc && 'id' in resolvedDoc).toBe(true)
  })

  it('the ArchiveBlock component prop type (ArchiveBlockProps) still accepts a real payload-types.ts archive block', () => {
    // Type-level only: `ArchiveBlockProps` (src/app/_blocks/ArchiveBlock/
    // types.ts) is now `StorefrontArchiveBlock` re-exported — this proves a
    // real Payload archive block still satisfies it unchanged.
    const props: ArchiveBlockProps = {
      introContent: [{ type: 'h3' }],
      populateBy: 'collection',
      relationTo: 'products',
      categories: ['cat-1', 'cat-2'],
      limit: 6,
      id: 'archive-2',
      blockName: 'Collection',
      blockType: 'archive',
    } as Extract<PayloadPage['layout'][number], { blockType: 'archive' }>
    expect(props.limit).toBe(6)
  })
})
