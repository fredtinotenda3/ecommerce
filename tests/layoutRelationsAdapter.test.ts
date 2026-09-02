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

// ---------------------------------------------------------------------------
// PHASE 13J — structural validation / fail-safe behavior
// ---------------------------------------------------------------------------
//
// The tests above (unchanged from before Phase 13J) already prove the
// well-formed-input relationship-resolution behavior is unchanged. These
// new tests target what Phase 13J actually added: real structural
// validation against NativeLayoutBlock/NativeHero/NativeCMSLink, and
// graceful (non-throwing) handling of missing/malformed data.

describe('resolveStorefrontLayout — Phase 13J validation/fail-safe behavior', () => {
  const baseDeps = () => ({
    mediaRepository: new FakeMediaRepository(),
    pageRepository: new FakePageRepository(),
  })

  it('does not throw for a cta block missing richText and links entirely', async () => {
    const result = await resolveStorefrontLayout([{ blockType: 'cta' }], baseDeps())
    expect(result).toEqual([{ blockType: 'cta', links: undefined }])
  })

  it('does not throw and passes links through unchanged when links is not an array', async () => {
    const result = await resolveStorefrontLayout(
      [{ blockType: 'cta', richText: [], links: 'not-an-array' }],
      baseDeps(),
    )
    expect((result[0] as Record<string, unknown>).links).toBe('not-an-array')
  })

  it('does not throw and passes the whole block through unchanged when columns is not an array', async () => {
    const block = { blockType: 'content', columns: 'not-an-array' }
    const result = await resolveStorefrontLayout([block], baseDeps())
    expect(result).toEqual([block])
  })

  it('does not throw for a mediaBlock missing its media field entirely', async () => {
    const result = await resolveStorefrontLayout([{ blockType: 'mediaBlock' }], baseDeps())
    expect((result[0] as Record<string, unknown>).media).toBeUndefined()
  })

  it('does not throw and skips non-object entries mixed into an otherwise-valid layout array', async () => {
    const result = await resolveStorefrontLayout(
      [null, 'not-a-block', 42, { blockType: 'mediaBlock', media: undefined }],
      baseDeps(),
    )
    expect(result).toEqual([null, 'not-a-block', 42, { blockType: 'mediaBlock', media: undefined }])
  })

  it('treats a link with a falsy reference.value as non-resolvable and passes it through unchanged', async () => {
    const result = await resolveStorefrontLayout(
      [
        {
          blockType: 'cta',
          richText: [],
          links: [{ link: { type: 'reference', label: 'Empty ref', reference: { relationTo: 'pages', value: '' } } }],
        },
      ],
      baseDeps(),
    )
    const block = result[0] as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(block.links[0].link.reference.value).toBe('')
  })

  it('fails safely (no throw) and returns the raw archive block untouched when the product repository throws', async () => {
    const throwingProductRepository = {
      getById: async () => {
        throw new Error('simulated repository failure')
      },
      getBySlug: async () => null,
      list: async () => [],
      setPrice: async () => null,
    }

    const rawBlock = {
      blockType: 'archive',
      introContent: [],
      populatedDocs: [{ relationTo: 'products', value: 'prod1' }],
    }

    const result = await resolveStorefrontLayout([rawBlock], {
      ...baseDeps(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productRepository: throwingProductRepository as any,
    })

    expect(result).toEqual([rawBlock])
  })

  it('passes an entirely unrecognized blockType through with no attempted resolution, even with relation-shaped fields', async () => {
    const block = {
      blockType: 'someFutureBlock',
      media: 'media1',
      links: [{ link: { type: 'reference', reference: { relationTo: 'pages', value: 'page1' } } }],
    }
    const result = await resolveStorefrontLayout([block], baseDeps())
    expect(result).toEqual([block])
  })
})

describe('resolveStorefrontHero — Phase 13J validation/fail-safe behavior', () => {
  it('still resolves media/links normally for a hero with an unrecognized type', async () => {
    const mediaRepository = new FakeMediaRepository()
    mediaRepository.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/hero.jpg' }))

    const result = await resolveStorefrontHero(
      { type: 'somethingUnexpected', richText: [], media: 'media1' },
      { mediaRepository, pageRepository: new FakePageRepository() },
    )

    expect(result?.type).toBe('somethingUnexpected')
    expect(result?.media).toMatchObject({ id: 'media1' })
  })

  it('does not throw for a hero missing richText/links/media entirely', async () => {
    const result = await resolveStorefrontHero(
      { type: 'none' },
      { mediaRepository: new FakeMediaRepository(), pageRepository: new FakePageRepository() },
    )
    expect(result).toEqual({ type: 'none', media: undefined, links: undefined })
  })

  it('fails safely (no throw) and returns the raw hero untouched when media resolution throws', async () => {
    const throwingMediaRepository = {
      getById: async () => {
        throw new Error('simulated repository failure')
      },
      list: async () => [],
    }

    const rawHero = { type: 'highImpact', richText: [], media: 'media1' }

    const result = await resolveStorefrontHero(rawHero, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mediaRepository: throwingMediaRepository as any,
      pageRepository: new FakePageRepository(),
    })

    expect(result).toEqual(rawHero)
  })
})
