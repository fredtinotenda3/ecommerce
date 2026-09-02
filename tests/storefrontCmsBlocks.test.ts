// tests/storefrontCmsBlocks.test.ts
//
// PHASE 13L — type-level tests for the `StorefrontCallToActionBlock` /
// `StorefrontContentBlock` / `StorefrontContentColumn` /
// `StorefrontHeroLinksContent` / `StorefrontLowImpactHero` view models
// added to src/app/_types/storefront.ts (derived from
// `NativeCallToActionBlock`/`NativeContentBlock`/`NativeHero` in
// src/lib/domain/types.ts). Same rationale as
// tests/storefrontCmsLink.test.ts (Phase 13K): these types have no runtime
// behavior of their own, so the main thing worth locking in is that a real
// `payload-types.ts` `Page['layout'][number]` / `Page['hero']` object
// still satisfies each narrowed type unchanged. Each literal below only
// type-checks if that stays true, so a future edit that breaks the
// relationship fails `npm run test`'s `tsc`-backed collection step the
// same as `npx tsc --noEmit` would.

import { describe, expect, it } from 'vitest'

import type {
  StorefrontCallToActionBlock,
  StorefrontContentBlock,
  StorefrontContentColumn,
  StorefrontHeroLinksContent,
  StorefrontLinkGroupItem,
  StorefrontLowImpactHero,
} from '../src/app/_types/storefront'
import type { Page as PayloadPage } from '../src/payload/payload-types'

describe('StorefrontCallToActionBlock (Phase 13L)', () => {
  it('accepts a minimal cta block with no links', () => {
    const block: StorefrontCallToActionBlock = {
      richText: [{ type: 'p' }],
    }
    expect(block.links).toBeUndefined()
  })

  it('accepts a real payload-types.ts cta block unchanged', () => {
    const payloadCta: Extract<PayloadPage['layout'][number], { blockType: 'cta' }> = {
      invertBackground: true,
      richText: [{ type: 'p' }],
      links: [
        {
          id: 'link-1',
          link: {
            type: 'custom',
            newTab: false,
            reference: { relationTo: 'pages', value: 'unused' },
            url: '/shop',
            label: 'Shop now',
            appearance: 'primary',
          },
        },
      ],
      id: 'cta-1',
      blockName: 'Main CTA',
      blockType: 'cta',
    }

    const storefrontCta: StorefrontCallToActionBlock = payloadCta
    expect(storefrontCta.links?.[0].link.label).toBe('Shop now')
    expect(storefrontCta.invertBackground).toBe(true)
  })
})

describe('StorefrontContentBlock / StorefrontContentColumn (Phase 13L)', () => {
  it('accepts a column with enableLink false and no link', () => {
    const column: StorefrontContentColumn = {
      richText: [{ type: 'p' }],
      enableLink: false,
    }
    expect(column.link).toBeUndefined()
  })

  it('accepts a real payload-types.ts content block unchanged', () => {
    const now = new Date().toISOString()
    const aboutPage: PayloadPage = {
      id: 'p1',
      title: 'About',
      slug: 'about',
      hero: { type: 'none', richText: [], media: 'm1' },
      layout: [],
      updatedAt: now,
      createdAt: now,
    } as PayloadPage

    const payloadContent: Extract<PayloadPage['layout'][number], { blockType: 'content' }> = {
      invertBackground: false,
      columns: [
        {
          size: 'half',
          richText: [{ type: 'p' }],
          enableLink: true,
          link: {
            type: 'reference',
            newTab: true,
            reference: { relationTo: 'pages', value: aboutPage },
            url: '',
            label: 'Learn more',
            appearance: 'default',
          },
          id: 'col-1',
        },
      ],
      id: 'content-1',
      blockName: 'Two column',
      blockType: 'content',
    }

    const storefrontContent: StorefrontContentBlock = payloadContent
    const referenceValue = storefrontContent.columns?.[0].link?.reference?.value
    expect(typeof referenceValue === 'object' && referenceValue?.slug).toBe('about')
  })
})

describe('StorefrontHeroLinksContent / StorefrontLowImpactHero (Phase 13L)', () => {
  it('accepts the richText/links subset of a real payload-types.ts Page hero unchanged', () => {
    const payloadHero: PayloadPage['hero'] = {
      type: 'highImpact',
      richText: [{ type: 'p' }],
      links: [
        {
          id: 'hero-link-1',
          link: {
            type: 'custom',
            newTab: false,
            reference: { relationTo: 'pages', value: 'unused' },
            url: '/shop',
            label: 'Shop the collection',
          },
        },
      ],
      media: 'media-id-123',
    }

    // HighImpactHero/MediumImpactHero/CustomHero only ever destructure
    // `richText`/`links` through this shared type — `media` is typed
    // separately by each of those components (see storefront.ts).
    const storefrontHeroContent: StorefrontHeroLinksContent = {
      richText: payloadHero.richText,
      links: payloadHero.links,
    }
    expect(storefrontHeroContent.links?.[0].link.label).toBe('Shop the collection')
  })

  it('accepts the richText-only subset a real payload-types.ts Page hero satisfies for LowImpactHero', () => {
    const payloadHero: PayloadPage['hero'] = {
      type: 'lowImpact',
      richText: [{ type: 'p' }],
      media: 'media-id-123',
    }

    const storefrontLowImpactHero: StorefrontLowImpactHero = payloadHero
    expect(storefrontLowImpactHero.richText).toEqual([{ type: 'p' }])
  })

  it('every StorefrontLinkGroupItem only needs an optional id, matching StorefrontNavItem', () => {
    const item: StorefrontLinkGroupItem = { link: { type: 'custom', url: '/x' } }
    expect(item.id).toBeUndefined()
  })
})
