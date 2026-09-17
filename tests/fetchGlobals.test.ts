// tests/fetchGlobals.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildStorefrontFooter,
  buildStorefrontHeader,
  buildStorefrontHome,
  buildStorefrontSettings,
} from '../src/app/_api/fetchGlobals'
import {
  buildTestFooter,
  buildTestHeader,
  buildTestHome,
  buildTestSettings,
  FakeGlobalsRepository,
} from './fakes/FakeGlobalsRepository'
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

    const result = await buildStorefrontSettings(globalsRepo, pageRepo, new FakeMediaRepository())

    expect(result).toMatchObject({ productsPage: { slug: 'products' } })
  })

  it('returns null when no Settings global exists yet, rather than throwing', async () => {
    const result = await buildStorefrontSettings(
      new FakeGlobalsRepository(),
      new FakePageRepository(),
      new FakeMediaRepository(),
    )
    expect(result).toBeNull()
  })

  it('leaves productsPage undefined when the linked page id no longer resolves', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    globalsRepo.seedSettings(buildTestSettings({ productsPageId: 'missing-page' }))

    const result = await buildStorefrontSettings(globalsRepo, new FakePageRepository(), new FakeMediaRepository())

    expect(result?.productsPage).toBeUndefined()
  })

  it('resolves brandBackgroundImageId to a storefront media item', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    const mediaRepo = new FakeMediaRepository()
    mediaRepo.seed(buildTestMedia({ id: 'bg1', url: '/media/brand-bg.webp', width: 2560, height: 1440 }))
    globalsRepo.seedSettings(buildTestSettings({ brandBackgroundImageId: 'bg1' }))

    const result = await buildStorefrontSettings(globalsRepo, new FakePageRepository(), mediaRepo)

    expect(result?.brandBackgroundImage).toMatchObject({ url: '/media/brand-bg.webp' })
  })

  it('leaves brandBackgroundImage null when the referenced media no longer resolves', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    globalsRepo.seedSettings(buildTestSettings({ brandBackgroundImageId: 'missing' }))

    const result = await buildStorefrontSettings(globalsRepo, new FakePageRepository(), new FakeMediaRepository())

    expect(result?.brandBackgroundImage).toBeNull()
  })
})

describe('buildStorefrontHome', () => {
  it('resolves the hero image, video and video poster media relations', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    const mediaRepo = new FakeMediaRepository()

    mediaRepo.seed(
      buildTestMedia({ id: 'hero1', url: '/media/hero.png', width: 900, height: 540, alt: 'A phone' }),
    )
    mediaRepo.seed(
      buildTestMedia({ id: 'video1', url: '/media/clip.mp4', mimeType: 'video/mp4' }),
    )
    mediaRepo.seed(buildTestMedia({ id: 'poster1', url: '/media/poster.jpg' }))

    globalsRepo.seedHome(
      buildTestHome({
        heroHeading: 'Custom heading',
        heroProofPoints: ['Fast delivery'],
        heroImageId: 'hero1',
        videoId: 'video1',
        videoPosterId: 'poster1',
      }),
    )

    const result = await buildStorefrontHome(globalsRepo, mediaRepo)

    expect(result?.heroHeading).toBe('Custom heading')
    expect(result?.heroProofPoints).toEqual(['Fast delivery'])
    expect(result?.heroImage).toMatchObject({ url: '/media/hero.png', width: 900, height: 540 })
    expect(result?.video).toMatchObject({ url: '/media/clip.mp4', mimeType: 'video/mp4' })
    expect(result?.videoPoster).toMatchObject({ url: '/media/poster.jpg' })
  })

  it('returns null when no Home global exists yet, rather than throwing', async () => {
    const result = await buildStorefrontHome(new FakeGlobalsRepository(), new FakeMediaRepository())
    expect(result).toBeNull()
  })

  it('leaves a media field null when the referenced media no longer resolves', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    globalsRepo.seedHome(buildTestHome({ heroImageId: 'missing' }))

    const result = await buildStorefrontHome(globalsRepo, new FakeMediaRepository())

    expect(result?.heroImage).toBeNull()
  })

  it('resolves a shared id (e.g. the same image reused as poster) only once', async () => {
    const globalsRepo = new FakeGlobalsRepository()
    const mediaRepo = new FakeMediaRepository()
    mediaRepo.seed(buildTestMedia({ id: 'shared1', url: '/media/shared.jpg' }))

    globalsRepo.seedHome(buildTestHome({ heroImageId: 'shared1', videoPosterId: 'shared1' }))

    const result = await buildStorefrontHome(globalsRepo, mediaRepo)

    expect(result?.heroImage?.url).toBe('/media/shared.jpg')
    expect(result?.videoPoster?.url).toBe('/media/shared.jpg')
  })
})
