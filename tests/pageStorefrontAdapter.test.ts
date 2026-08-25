// tests/pageStorefrontAdapter.test.ts
import { describe, expect, it } from 'vitest'
import { toStorefrontPage } from '../src/lib/repositories/adapters/pageStorefrontAdapter'
import { buildTestMedia } from './fakes/FakeMediaRepository'
import { buildTestPage } from './fakes/FakePageRepository'

describe('toStorefrontPage', () => {
  it('maps a page to the shape the CMS Blocks renderer expects', () => {
    const page = buildTestPage({
      id: 'page1',
      title: 'About Us',
      slug: 'about',
      status: 'published',
      meta: { title: 'About Us | Store', description: 'Our story.', imageId: 'media1' },
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })
    const media = buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/about.jpg' })
    const layout = [{ blockType: 'content', columns: [] }]
    const hero = { type: 'lowImpact', richText: [] }

    const result = toStorefrontPage(page, { hero, layout, metaImage: media })

    expect(result.id).toBe('page1')
    expect(result.title).toBe('About Us')
    expect(result.slug).toBe('about')
    expect(result._status).toBe('published')
    expect(result.hero).toBe(hero)
    expect(result.layout).toBe(layout)
    expect(result.meta).toMatchObject({
      title: 'About Us | Store',
      description: 'Our story.',
      image: expect.objectContaining({ id: 'media1', url: 'https://cdn.example.com/about.jpg' }),
    })
  })

  it('falls back to a "none" hero shape when hero resolution returns null', () => {
    const page = buildTestPage()

    const result = toStorefrontPage(page, { hero: null, layout: [], metaImage: null })

    expect(result.hero).toMatchObject({ type: 'none' })
  })

  it('leaves meta.image undefined when there is no meta image', () => {
    const page = buildTestPage()

    const result = toStorefrontPage(page, { hero: null, layout: [], metaImage: null })

    expect(result.meta?.image).toBeUndefined()
  })
})
