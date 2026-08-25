// tests/layoutRelationsAdapter.test.ts
import { describe, expect, it } from 'vitest'
import {
  resolveStorefrontHero,
  resolveStorefrontLayout,
} from '../src/lib/repositories/adapters/layoutRelationsAdapter'
import { buildTestMedia, FakeMediaRepository } from './fakes/FakeMediaRepository'
import { buildTestPage, FakePageRepository } from './fakes/FakePageRepository'
import { buildTestProduct, FakeProductRepository } from './fakes/FakeProductRepository'

describe('resolveStorefrontLayout', () => {
  it('returns an empty array for non-array or empty input', async () => {
    const deps = {
      mediaRepository: new FakeMediaRepository(),
      pageRepository: new FakePageRepository(),
    }
    expect(await resolveStorefrontLayout(undefined, deps)).toEqual([])
    expect(await resolveStorefrontLayout([], deps)).toEqual([])
  })

  it('resolves a mediaBlock media id into a full Media object', async () => {
    const mediaRepository = new FakeMediaRepository()
    mediaRepository.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/x.jpg' }))

    const result = await resolveStorefrontLayout(
      [{ blockType: 'mediaBlock', position: 'default', media: 'media1' }],
      { mediaRepository, pageRepository: new FakePageRepository() },
    )

    expect(result).toEqual([
      {
        blockType: 'mediaBlock',
        position: 'default',
        media: expect.objectContaining({ id: 'media1', url: 'https://cdn.example.com/x.jpg' }),
      },
    ])
  })

  it('leaves mediaBlock media untouched (undefined) when the referenced media cannot be found', async () => {
    const result = await resolveStorefrontLayout(
      [{ blockType: 'mediaBlock', position: 'default', media: 'missing-media' }],
      { mediaRepository: new FakeMediaRepository(), pageRepository: new FakePageRepository() },
    )

    expect((result[0] as Record<string, unknown>).media).toBeUndefined()
  })

  it('resolves a cta block link reference into { relationTo, value: { slug } }', async () => {
    const pageRepository = new FakePageRepository()
    pageRepository.seed(buildTestPage({ id: 'page1', slug: 'contact' }))

    const result = await resolveStorefrontLayout(
      [
        {
          blockType: 'cta',
          richText: [],
          links: [
            {
              link: { type: 'reference', label: 'Contact', reference: { relationTo: 'pages', value: 'page1' } },
            },
          ],
        },
      ],
      { mediaRepository: new FakeMediaRepository(), pageRepository },
    )

    const block = result[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(block.links[0].link.reference.value).toEqual({ id: 'page1', slug: 'contact' })
  })

  it('resolves content block column links only when enableLink is set', async () => {
    const pageRepository = new FakePageRepository()
    pageRepository.seed(buildTestPage({ id: 'page1', slug: 'contact' }))

    const result = await resolveStorefrontLayout(
      [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: [],
              enableLink: true,
              link: { type: 'reference', reference: { relationTo: 'pages', value: 'page1' } },
            },
            { size: 'full', richText: [], enableLink: false },
          ],
        },
      ],
      { mediaRepository: new FakeMediaRepository(), pageRepository },
    )

    const block = result[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(block.columns[0].link.reference.value).toEqual({ id: 'page1', slug: 'contact' })
    expect(block.columns[1].link).toBeUndefined()
  })

  it('resolves archive populatedDocs product refs into the minimal Card-shaped Product', async () => {
    const mediaRepository = new FakeMediaRepository()
    const productRepository = new FakeProductRepository()
    productRepository.seed(
      buildTestProduct({
        id: 'prod1',
        slug: 'trail-boots',
        title: 'Trail Boots',
        legacyPriceJSON: '{"data":[{"unit_amount":4999}]}',
      }),
    )

    const result = await resolveStorefrontLayout(
      [
        {
          blockType: 'archive',
          introContent: [],
          populateBy: 'selection',
          relationTo: 'products',
          populatedDocs: [{ relationTo: 'products', value: 'prod1' }],
        },
      ],
      { mediaRepository, pageRepository: new FakePageRepository(), productRepository },
    )

    const block = result[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(block.populatedDocs[0].value).toMatchObject({
      id: 'prod1',
      slug: 'trail-boots',
      title: 'Trail Boots',
      priceJSON: '{"data":[{"unit_amount":4999}]}',
    })
  })

  it('leaves archive populatedDocs untouched when no productRepository is provided', async () => {
    const raw = [{ relationTo: 'products', value: 'prod1' }]
    const result = await resolveStorefrontLayout(
      [{ blockType: 'archive', introContent: [], populatedDocs: raw }],
      { mediaRepository: new FakeMediaRepository(), pageRepository: new FakePageRepository() },
    )

    expect((result[0] as Record<string, unknown>).populatedDocs).toBe(raw)
  })

  it('passes unknown block types through untouched', async () => {
    const block = { blockType: 'someFutureBlock', foo: 'bar' }
    const result = await resolveStorefrontLayout([block], {
      mediaRepository: new FakeMediaRepository(),
      pageRepository: new FakePageRepository(),
    })

    expect(result).toEqual([block])
  })
})

describe('resolveStorefrontHero', () => {
  it('returns null for a missing hero', async () => {
    const result = await resolveStorefrontHero(null, {
      mediaRepository: new FakeMediaRepository(),
      pageRepository: new FakePageRepository(),
    })
    expect(result).toBeNull()
  })

  it('resolves hero media and link references the same way as layout blocks', async () => {
    const mediaRepository = new FakeMediaRepository()
    mediaRepository.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/hero.jpg' }))
    const pageRepository = new FakePageRepository()
    pageRepository.seed(buildTestPage({ id: 'page1', slug: 'shop' }))

    const result = await resolveStorefrontHero(
      {
        type: 'highImpact',
        richText: [],
        media: 'media1',
        links: [{ link: { type: 'reference', reference: { relationTo: 'pages', value: 'page1' } } }],
      },
      { mediaRepository, pageRepository },
    )

    expect(result?.media).toMatchObject({ id: 'media1', url: 'https://cdn.example.com/hero.jpg' })
    expect(result?.links[0].link.reference.value).toEqual({ id: 'page1', slug: 'shop' })
  })
})
