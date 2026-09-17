// tests/globalsStorefrontAdapter.test.ts
import { describe, expect, it } from 'vitest'
import type { ResolvedNavRelations } from '../src/lib/repositories/adapters/globalsStorefrontAdapter'
import {
  toStorefrontFooter,
  toStorefrontHeader,
  toStorefrontHome,
  toStorefrontSettings,
} from '../src/lib/repositories/adapters/globalsStorefrontAdapter'
import {
  buildTestFooter,
  buildTestHeader,
  buildTestHome,
  buildTestSettings,
} from './fakes/FakeGlobalsRepository'
import {
  DEFAULT_FOOTER_LINK_GROUPS,
  DEFAULT_INCLUSIONS,
  DEFAULT_SITE_NAME,
  DEFAULT_SOCIAL_LINKS,
} from '../src/lib/domain/siteDefaults'
import type { StorefrontMediaItem } from '../src/app/_types/storefront'

const emptyRelations = (): ResolvedNavRelations => ({
  pageSlugsById: new Map(),
  mediaUrlsById: new Map(),
})

describe('toStorefrontHeader', () => {
  it('builds the header view model for a reference-type link', () => {
    const header = buildTestHeader({
      id: 'header1',
      navItems: [
        {
          link: {
            type: 'reference',
            newTab: false,
            label: 'Shop',
            referencePageId: 'page1',
            referenceRelationTo: 'pages',
          },
        },
      ],
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })

    const resolved: ResolvedNavRelations = {
      pageSlugsById: new Map([['page1', 'shop']]),
      mediaUrlsById: new Map(),
    }

    const result = toStorefrontHeader(header, resolved)

    expect(result).toEqual({
      navItems: [
        {
          link: {
            type: 'reference',
            newTab: false,
            label: 'Shop',
            url: undefined,
            reference: { relationTo: 'pages', value: { slug: 'shop' } },
          },
        },
      ],
    })
  })

  it('builds the header view model for a custom-url link', () => {
    const header = buildTestHeader({
      navItems: [
        { link: { type: 'custom', label: 'External', url: 'https://example.com', newTab: true } },
      ],
    })

    const result = toStorefrontHeader(header, emptyRelations())

    expect(result.navItems[0].link).toEqual({
      type: 'custom',
      newTab: true,
      label: 'External',
      url: 'https://example.com',
    })
  })

  it('omits the reference field when the referenced page cannot be resolved', () => {
    const header = buildTestHeader({
      navItems: [
        {
          link: {
            type: 'reference',
            label: 'Broken',
            referencePageId: 'missing-page',
            referenceRelationTo: 'pages',
          },
        },
      ],
    })

    const result = toStorefrontHeader(header, emptyRelations())

    expect(result.navItems[0].link.reference).toBeUndefined()
  })

  it('resolves an icon media id to a url object', () => {
    const header = buildTestHeader({
      navItems: [
        { link: { type: 'custom', url: 'https://example.com', label: 'X', iconMediaId: 'media1' } },
      ],
    })

    const resolved: ResolvedNavRelations = {
      pageSlugsById: new Map(),
      mediaUrlsById: new Map([['media1', 'https://cdn.example.com/x-icon.svg']]),
    }

    const result = toStorefrontHeader(header, resolved)

    expect(result.navItems[0].link.icon).toEqual({ url: 'https://cdn.example.com/x-icon.svg' })
  })

  it('returns an empty navItems array when there are none', () => {
    const header = buildTestHeader({ navItems: [] })
    const result = toStorefrontHeader(header, emptyRelations())
    expect(result.navItems).toEqual([])
  })
})

describe('toStorefrontFooter', () => {
  it('builds the footer view model, including copyright', () => {
    const footer = buildTestFooter({
      id: 'footer1',
      copyright: '© 2024 Test Store',
      navItems: [{ link: { type: 'custom', url: 'https://instagram.com', label: 'Instagram' } }],
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })

    const result = toStorefrontFooter(footer, emptyRelations())

    // `linkGroups` falls back to `DEFAULT_FOOTER_LINK_GROUPS` here because
    // `buildTestFooter`'s own default is `linkGroups: []` (unconfigured) —
    // see the next test for the case where an operator has set real groups.
    expect(result).toEqual({
      copyright: '© 2024 Test Store',
      navItems: [{ link: { type: 'custom', url: 'https://instagram.com', label: 'Instagram' } }],
      linkGroups: DEFAULT_FOOTER_LINK_GROUPS,
    })
  })

  it('carries admin-configured link groups through without falling back to the defaults', () => {
    const customGroups = [{ title: 'Custom', links: [{ label: 'One', href: '/one' }] }]
    const footer = buildTestFooter({ linkGroups: customGroups })

    const result = toStorefrontFooter(footer, emptyRelations())

    expect(result.linkGroups).toEqual(customGroups)
  })

  it('falls back to an empty string when copyright is null', () => {
    const footer = buildTestFooter({ copyright: null })
    const result = toStorefrontFooter(footer, emptyRelations())
    expect(result.copyright).toBe('')
  })
})

describe('toStorefrontSettings', () => {
  it('builds the settings view model when the products page resolves', () => {
    const settings = buildTestSettings({
      id: 'settings1',
      productsPageId: 'page1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })

    const result = toStorefrontSettings(settings, 'products', null)

    // A partial match, not `toEqual`: every other field falls back
    // independently to `siteDefaults.ts` (see that function's own doc
    // comment), so a `toEqual` here would freeze every default's exact
    // wording as part of this test.
    expect(result).toMatchObject({
      productsPage: { slug: 'products' },
    })
  })

  it('leaves productsPage undefined when there is no linked page', () => {
    const settings = buildTestSettings({ productsPageId: null })
    const result = toStorefrontSettings(settings, null, null)
    expect(result.productsPage).toBeUndefined()
  })

  it('leaves productsPage undefined when the linked page cannot be resolved', () => {
    const settings = buildTestSettings({ productsPageId: 'missing-page' })
    const result = toStorefrontSettings(settings, null, null)
    expect(result.productsPage).toBeUndefined()
  })

  it('falls back to siteDefaults for every field an operator has not configured', () => {
    const settings = buildTestSettings({ productsPageId: null })
    const result = toStorefrontSettings(settings, null, null)

    expect(result.siteName).toBe(DEFAULT_SITE_NAME)
    expect(result.socialLinks).toEqual(DEFAULT_SOCIAL_LINKS)
    expect(result.inclusions).toEqual(DEFAULT_INCLUSIONS)
    expect(result.testimonials).toEqual([])
    expect(result.brandBackgroundImage).toBeNull()
  })

  it('prefers admin-configured fields over the defaults once set', () => {
    const settings = buildTestSettings({
      siteName: 'Custom Shop',
      socialLinks: [{ platform: 'instagram', label: null, url: 'https://instagram.com/custom' }],
    })
    const backgroundImage = { url: '/media/bg.webp' }

    const result = toStorefrontSettings(settings, null, backgroundImage)

    expect(result.siteName).toBe('Custom Shop')
    expect(result.socialLinks).toEqual([
      { platform: 'instagram', label: null, url: 'https://instagram.com/custom' },
    ])
    expect(result.brandBackgroundImage).toBe(backgroundImage)
  })
})

describe('toStorefrontHome', () => {
  it('carries copy fields through and resolves the three media relations', () => {
    const home = buildTestHome({
      heroHeading: 'Heading',
      heroImageId: 'hero1',
      videoId: 'video1',
      videoPosterId: 'poster1',
    })

    const mediaById = new Map<string, StorefrontMediaItem | null>([
      ['hero1', { url: '/media/hero.png' }],
      ['video1', { url: '/media/clip.mp4', mimeType: 'video/mp4' }],
      ['poster1', { url: '/media/poster.jpg' }],
    ])

    const result = toStorefrontHome(home, mediaById)

    expect(result.heroHeading).toBe('Heading')
    expect(result.heroImage).toEqual({ url: '/media/hero.png' })
    expect(result.video).toEqual({ url: '/media/clip.mp4', mimeType: 'video/mp4' })
    expect(result.videoPoster).toEqual({ url: '/media/poster.jpg' })
  })

  it('leaves media fields null when no id is set', () => {
    const home = buildTestHome()
    const result = toStorefrontHome(home, new Map())

    expect(result.heroImage).toBeNull()
    expect(result.video).toBeNull()
    expect(result.videoPoster).toBeNull()
  })
})
