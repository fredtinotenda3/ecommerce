// tests/globalsStorefrontAdapter.test.ts
import { describe, expect, it } from 'vitest'
import type { ResolvedNavRelations } from '../src/lib/repositories/adapters/globalsStorefrontAdapter'
import {
  toStorefrontFooter,
  toStorefrontHeader,
  toStorefrontSettings,
} from '../src/lib/repositories/adapters/globalsStorefrontAdapter'
import { buildTestFooter, buildTestHeader, buildTestSettings } from './fakes/FakeGlobalsRepository'

const emptyRelations = (): ResolvedNavRelations => ({
  pageSlugsById: new Map(),
  mediaUrlsById: new Map(),
})

describe('toStorefrontHeader', () => {
  it('matches the GraphQL HEADER query shape for a reference-type link', () => {
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
      id: 'header1',
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
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    })
  })

  it('matches the GraphQL HEADER query shape for a custom-url link', () => {
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
  it('matches the GraphQL FOOTER query shape, including copyright', () => {
    const footer = buildTestFooter({
      id: 'footer1',
      copyright: '© 2024 Test Store',
      navItems: [{ link: { type: 'custom', url: 'https://instagram.com', label: 'Instagram' } }],
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })

    const result = toStorefrontFooter(footer, emptyRelations())

    expect(result).toEqual({
      id: 'footer1',
      copyright: '© 2024 Test Store',
      navItems: [{ link: { type: 'custom', url: 'https://instagram.com', label: 'Instagram' } }],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    })
  })

  it('falls back to an empty string when copyright is null', () => {
    const footer = buildTestFooter({ copyright: null })
    const result = toStorefrontFooter(footer, emptyRelations())
    expect(result.copyright).toBe('')
  })
})

describe('toStorefrontSettings', () => {
  it('matches the GraphQL SETTINGS query shape when the products page resolves', () => {
    const settings = buildTestSettings({
      id: 'settings1',
      productsPageId: 'page1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })

    const result = toStorefrontSettings(settings, 'products')

    expect(result).toEqual({
      id: 'settings1',
      productsPage: { slug: 'products' },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    })
  })

  it('leaves productsPage undefined when there is no linked page', () => {
    const settings = buildTestSettings({ productsPageId: null })
    const result = toStorefrontSettings(settings, null)
    expect(result.productsPage).toBeUndefined()
  })

  it('leaves productsPage undefined when the linked page cannot be resolved', () => {
    const settings = buildTestSettings({ productsPageId: 'missing-page' })
    const result = toStorefrontSettings(settings, null)
    expect(result.productsPage).toBeUndefined()
  })
})
