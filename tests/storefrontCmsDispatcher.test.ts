// tests/storefrontCmsDispatcher.test.ts
//
// PHASE 13Q — type-level tests for the `StorefrontLayoutBlock` /
// `StorefrontLayoutBlockType` / `StorefrontHero` dispatcher view models
// added to src/app/_types/storefront.ts (derived from `NativeLayoutBlock`/
// `NativeHeroType` in src/lib/domain/types.ts). Same rationale as
// tests/storefrontCmsBlocks.test.ts (Phase 13L): these types have no
// runtime behavior of their own, so the main thing worth locking in is that
// a real `payload-types.ts` `Page['layout'][number]` / `Page['hero']`
// object still satisfies each narrowed type unchanged, and that the
// `Blocks`/`Hero` dispatcher components themselves still accept real
// Payload-shaped page data unmodified. Each assignment below only
// type-checks if that stays true, so a future edit that breaks the
// relationship fails `npm run test`'s `tsc`-backed collection step the same
// as `npx tsc --noEmit` would.

import { describe, expect, it } from 'vitest'

import { Blocks } from '../src/app/_components/Blocks'
import { Hero } from '../src/app/_components/Hero'
import type { StorefrontHero, StorefrontLayoutBlock } from '../src/app/_types/storefront'
import type { Page as PayloadPage } from '../src/payload/payload-types'

describe('StorefrontLayoutBlock (Phase 13Q)', () => {
  it('accepts a minimal block with only the fields the Blocks dispatcher reads', () => {
    const block: StorefrontLayoutBlock = { blockType: 'archive' }
    expect(block.invertBackground).toBeUndefined()
    expect(block.id).toBeUndefined()
    expect(block.blockName).toBeUndefined()
  })

  it('accepts every real payload-types.ts Page[layout] block variant unchanged', () => {
    const now = new Date().toISOString()
    const page: PayloadPage = {
      id: 'p1',
      title: 'Test',
      slug: 'test',
      hero: { type: 'none', richText: [], media: 'm1' },
      layout: [
        {
          invertBackground: true,
          richText: [{ type: 'p' }],
          id: 'cta-1',
          blockName: 'CTA',
          blockType: 'cta',
        },
        {
          invertBackground: false,
          columns: [],
          id: 'content-1',
          blockName: 'Content',
          blockType: 'content',
        },
        {
          invertBackground: false,
          position: 'default',
          media: 'media-1',
          id: 'media-1',
          blockName: 'Media',
          blockType: 'mediaBlock',
        },
        {
          introContent: [],
          populateBy: 'collection',
          relationTo: 'products',
          id: 'archive-1',
          blockName: 'Archive',
          blockType: 'archive',
        },
      ],
      updatedAt: now,
      createdAt: now,
    } as PayloadPage

    // This is exactly what `src/app/(pages)/[slug]/page.tsx`,
    // `products/page.tsx`, and `cart/page.tsx` do today: pass a real
    // `payload-types.ts` `Page['layout']` straight through to `<Blocks
    // blocks={...} />`.
    const storefrontBlocks: StorefrontLayoutBlock[] = page.layout
    expect(storefrontBlocks).toHaveLength(4)
    expect(storefrontBlocks.map(b => b.blockType)).toEqual([
      'cta',
      'content',
      'mediaBlock',
      'archive',
    ])
    // The `archive` block variant has no `invertBackground` field in
    // `payload-types.ts` — confirms the optional-on-every-variant modelling
    // decision documented on `StorefrontLayoutBlock`.
    expect(storefrontBlocks[3].invertBackground).toBeUndefined()
  })

  it('the Blocks dispatcher component still accepts a real payload-types.ts Page[layout] prop', () => {
    // Type-level only: this doesn't render, it just proves `Blocks`' own
    // declared `blocks` prop type still accepts a real Payload `layout`
    // array unchanged — i.e. that Phase 13Q's narrowing didn't require any
    // caller-side change.
    const props: Parameters<typeof Blocks>[0] = {
      blocks: [
        {
          invertBackground: true,
          richText: [{ type: 'p' }],
          id: 'cta-1',
          blockName: 'CTA',
          blockType: 'cta',
        },
      ] as PayloadPage['layout'],
    }
    expect(props.blocks).toHaveLength(1)
  })
})

describe('StorefrontHero (Phase 13Q)', () => {
  it('accepts a minimal hero with only the field the Hero dispatcher reads', () => {
    const hero: StorefrontHero = { type: 'lowImpact' }
    expect(hero.type).toBe('lowImpact')
  })

  it('accepts every real payload-types.ts Page[hero] type variant unchanged', () => {
    const heroTypes: PayloadPage['hero']['type'][] = [
      'none',
      'highImpact',
      'mediumImpact',
      'lowImpact',
      'customHero',
    ]

    heroTypes.forEach(type => {
      const payloadHero: PayloadPage['hero'] = {
        type,
        richText: [{ type: 'p' }],
        media: 'media-id-123',
      }

      // This is exactly what `src/app/(pages)/[slug]/page.tsx` does today:
      // `<Hero {...hero} />` where `hero` is a real `payload-types.ts`
      // `Page['hero']`.
      const storefrontHero: StorefrontHero = payloadHero
      expect(storefrontHero.type).toBe(type)
    })
  })

  it('the Hero dispatcher component still accepts a real payload-types.ts Page[hero] prop', () => {
    const props: Parameters<typeof Hero>[0] = {
      type: 'highImpact',
      richText: [{ type: 'p' }],
      links: [],
      media: 'media-id-123',
    } as PayloadPage['hero']
    expect(props.type).toBe('highImpact')
  })
})
