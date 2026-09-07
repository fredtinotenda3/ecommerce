// tests/nativeCmsLayoutTypes.test.ts
//
// PHASE 13I — pure type-level tests for the new native CMS layout/hero
// types added to src/lib/domain/types.ts. These types have no runtime
// behavior and no consumers yet (see the Phase 13I report), so there is
// nothing to exercise except the type system itself:
//   - every literal object below only type-checks if the shapes in
//     domain/types.ts are actually structurally correct (a typo'd or
//     missing field fails `npm run test`'s `tsc`-backed collection step
//     the same as it would fail `npx tsc --noEmit`)
//   - the discriminant assertions below fail at RUNTIME if narrowing on
//     `blockType`/`hero.type` ever stops working, which is the one
//     behavior docs/native-cms-layout-plan.md §5 specifically flags as a
//     silent-failure risk ("degrades to any/unknown ... without a
//     visible error, given strict: false")
//
// No import from any CMS-generated type anywhere in this
// file — only `src/lib/domain/types.ts`.

import { describe, expect, it } from 'vitest'

import type {
  NativeArchiveBlock,
  NativeCallToActionBlock,
  NativeCMSLink,
  NativeContentBlock,
  NativeHero,
  NativeLayoutBlock,
  NativeLinkGroupItem,
  NativeMediaLayoutBlock,
} from '../src/lib/domain/types'

describe('native CMS layout/hero types (Phase 13I foundation)', () => {
  it('accepts a minimal, and a fully-populated, cta block', () => {
    const minimal: NativeCallToActionBlock = {
      blockType: 'cta',
      richText: [],
    }
    expect(minimal.blockType).toBe('cta')

    const link: NativeCMSLink = {
      type: 'custom',
      newTab: true,
      url: 'https://example.com',
      label: 'Shop now',
      appearance: 'primary',
    }
    const linkGroupItem: NativeLinkGroupItem = { id: 'link-1', link }
    const full: NativeCallToActionBlock = {
      blockType: 'cta',
      id: 'block-1',
      blockName: 'Homepage CTA',
      invertBackground: true,
      richText: [{ type: 'paragraph', children: [{ text: 'Hello' }] }],
      links: [linkGroupItem],
    }
    expect(full.links?.[0].link.label).toBe('Shop now')
  })

  it('supports a reference-type link with an unresolved (string) page id', () => {
    const link: NativeCMSLink = {
      type: 'reference',
      label: 'About us',
      reference: { relationTo: 'pages', value: 'page-id-123' },
    }
    expect(link.reference?.value).toBe('page-id-123')
  })

  it('accepts a content block with columns, including an enabled link', () => {
    const block: NativeContentBlock = {
      blockType: 'content',
      columns: [
        {
          size: 'half',
          richText: [],
          enableLink: true,
          link: { label: 'Learn more', url: '/about' },
        },
        { size: 'half', richText: [] },
      ],
    }
    expect(block.columns).toHaveLength(2)
    expect(block.columns?.[0].link?.label).toBe('Learn more')
  })

  it('accepts a mediaBlock with an unresolved (string) media id', () => {
    const block: NativeMediaLayoutBlock = {
      blockType: 'mediaBlock',
      media: 'media-id-abc',
      position: 'fullscreen',
    }
    expect(block.media).toBe('media-id-abc')
  })

  it('accepts an archive block for both populateBy modes', () => {
    const collectionMode: NativeArchiveBlock = {
      blockType: 'archive',
      introContent: [],
      populateBy: 'collection',
      relationTo: 'products',
      categories: ['cat-1', 'cat-2'],
      limit: 10,
    }
    expect(collectionMode.categories).toEqual(['cat-1', 'cat-2'])

    const selectionMode: NativeArchiveBlock = {
      blockType: 'archive',
      introContent: [],
      populateBy: 'selection',
      selectedDocs: [{ relationTo: 'products', value: 'prod-1' }],
      populatedDocs: [{ relationTo: 'products', value: 'prod-1' }],
      populatedDocsTotal: 1,
    }
    expect(selectionMode.selectedDocs?.[0].value).toBe('prod-1')
  })

  it('preserves discriminated-union narrowing on blockType across all four members', () => {
    const blocks: NativeLayoutBlock[] = [
      { blockType: 'cta', richText: [] },
      { blockType: 'content' },
      { blockType: 'mediaBlock', media: 'media-1' },
      { blockType: 'archive', introContent: [] },
    ]

    const seen: string[] = []
    for (const block of blocks) {
      switch (block.blockType) {
        case 'cta':
          // Only compiles if narrowing worked: `richText` doesn't exist
          // on the other three members.
          seen.push(`cta:${block.richText.length}`)
          break
        case 'content':
          seen.push(`content:${block.columns?.length ?? 0}`)
          break
        case 'mediaBlock':
          seen.push(`mediaBlock:${block.media}`)
          break
        case 'archive':
          seen.push(`archive:${block.introContent.length}`)
          break
      }
    }

    expect(seen).toEqual(['cta:0', 'content:0', 'mediaBlock:media-1', 'archive:0'])
  })

  it('accepts a hero object for every hero type, sharing one field shape', () => {
    const heroes: NativeHero[] = [
      { type: 'none', richText: [], media: 'media-1' },
      { type: 'highImpact', richText: [], media: 'media-1', links: [] },
      { type: 'mediumImpact', richText: [], media: 'media-1' },
      { type: 'lowImpact', richText: [], media: 'media-1' },
      { type: 'customHero', richText: [], media: 'media-1' },
    ]

    expect(heroes.map(hero => hero.type)).toEqual([
      'none',
      'highImpact',
      'mediumImpact',
      'lowImpact',
      'customHero',
    ])
  })
})
