// tests/fetchGlobals.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildStorefrontFooter,
  buildStorefrontHeader,
  buildStorefrontSettings,
} from '../src/app/_api/fetchGlobals'
import { buildTestFooter, buildTestHeader, buildTestSettings, FakeGlobalsRepository } from './fakes/FakeGlobalsRepository'
import { FakeMediaRepository, buildTestMedia } from './fakes/FakeMediaRepository'
import { buildTestPage, FakePageRepository } from './fakes/FakePageRepository'

describe('buildStorefrontHeader', () => {
  it('resolves nav item page and media references and matches the GraphQL HEADER query shape', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    const pageRepo = new FakePageRepository()
    const mediaRepo = new FakeMediaRepository()

    pageRepo.seed(buildTestPage({ id: 'page1', slug: 'shop' }))
    mediaRepo.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/icon.svg' }))

    globalsRepo.seedHeader(
      buildTestHeader({
        id: 'header1',
        navItems: [
          {
            link: {
              type: 'reference',
              label: 'Shop',
              referencePageId: 'page1',
              referenceRelationTo: 'pages',
              iconMediaId: 'media1',
            },
          },
        ],
      }),
    )

    const result = await buildStorefrontHeader(globalsRepo, pageRepo, mediaRepo)

    expect(result?.navItems).toHaveLength(1)
    expect(result?.navItems?.[0].link.reference).toEqual({
      relationTo: 'pages',
      value: { slug: 'shop' },
    })
    expect(result?.navItems?.[0].link.icon).toEqual({ url: 'https://cdn.example.com/icon.svg' })
  })

  it('returns null when no Header global exists yet, rather than throwing', async () => {
    const result = await buildStorefrontHeader(
      new FakeGlobalsRepository(),
      new FakePageRepository(),
      new FakeMediaRepository(),
    )
    expect(result).toBeNull()
  })

  it('does not throw when a nav item references a page that no longer exists', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    globalsRepo.seedHeader(
      buildTestHeader({
        navItems: [
          { link: { type: 'reference', label: 'Broken', referencePageId: 'gone', referenceRelationTo: 'pages' } },
        ],
      }),
    )

    const result = await buildStorefrontHeader(
      globalsRepo,
      new FakePageRepository(),
      new FakeMediaRepository(),
    )

    expect(result?.navItems?.[0].link.reference).toBeUndefined()
  })
})

describe('buildStorefrontFooter', () => {
  it('resolves nav items and preserves copyright, matching the GraphQL FOOTER query shape', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    const mediaRepo = new FakeMediaRepository()
    mediaRepo.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/insta.svg' }))

    globalsRepo.seedFooter(
      buildTestFooter({
        id: 'footer1',
        copyright: '© 2024 Test Store',
        navItems: [
          { link: { type: 'custom', url: 'https://instagram.com', label: 'Instagram', iconMediaId: 'media1' } },
        ],
      }),
    )

    const result = await buildStorefrontFooter(globalsRepo, new FakePageRepository(), mediaRepo)

    expect(result?.copyright).toBe('© 2024 Test Store')
    expect(result?.navItems?.[0].link.icon).toEqual({ url: 'https://cdn.example.com/insta.svg' })
  })

  it('returns null when no Footer global exists yet, rather than throwing', async () => {
    const result = await buildStorefrontFooter(
      new FakeGlobalsRepository(),
      new FakePageRepository(),
      new FakeMediaRepository(),
    )
    expect(result).toBeNull()
  })
})

describe('buildStorefrontSettings', () => {
  it('resolves productsPage to a slug', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    const pageRepo = new FakePageRepository()
    pageRepo.seed(buildTestPage({ id: 'page1', slug: 'products' }))
    globalsRepo.seedSettings(buildTestSettings({ id: 'settings1', productsPageId: 'page1' }))

    const result = await buildStorefrontSettings(globalsRepo, pageRepo)

    expect(result).toMatchObject({ productsPage: { slug: 'products' } })
  })

  it('returns null when no Settings global exists yet, rather than throwing', async () => {
    const result = await buildStorefrontSettings(new FakeGlobalsRepository(), new FakePageRepository())
    expect(result).toBeNull()
  })

  it('leaves productsPage undefined when the linked page id no longer resolves', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    globalsRepo.seedSettings(buildTestSettings({ productsPageId: 'missing-page' }))

    const result = await buildStorefrontSettings(globalsRepo, new FakePageRepository())

    expect(result?.productsPage).toBeUndefined()
  })
})
