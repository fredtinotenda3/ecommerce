// tests/fetchPageNative.test.ts
import { describe, expect, it } from 'vitest'
import { buildStorefrontPage } from '../src/app/_api/fetchPageNative'
import { buildTestMedia, FakeMediaRepository } from './fakes/FakeMediaRepository'
import { buildTestPage, FakePageRepository } from './fakes/FakePageRepository'
import { FakeProductRepository } from './fakes/FakeProductRepository'

const buildDeps = () => ({
  pageRepository: new FakePageRepository(),
  mediaRepository: new FakeMediaRepository(),
  productRepository: new FakeProductRepository(),
})

describe('buildStorefrontPage', () => {
  it('resolves hero, layout, and meta image for the CMS Blocks renderer', async () => {
    const deps = buildDeps()
    deps.mediaRepository.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/hero.jpg' }))

    deps.pageRepository.seed(
      buildTestPage({
        id: 'page1',
        slug: 'about',
        meta: { title: 'About', description: 'Our story.', imageId: 'media1' },
        hero: { type: 'highImpact', richText: [], media: 'media1' },
        layout: [{ blockType: 'content', columns: [] }],
      }),
    )

    const result = await buildStorefrontPage('about', deps)

    expect(result).toMatchObject({
      id: 'page1',
      slug: 'about',
      hero: { type: 'highImpact', media: expect.objectContaining({ id: 'media1' }) },
      layout: [{ blockType: 'content', columns: [] }],
      meta: { title: 'About', description: 'Our story.', image: expect.objectContaining({ id: 'media1' }) },
    })
  })

  it('returns null when no page matches the slug (matches fetchDoc\'s not-found behavior)', async () => {
    const result = await buildStorefrontPage('does-not-exist', buildDeps())
    expect(result).toBeNull()
  })

  it('respects the status filter the same way fetchDoc\'s `draft` flag does', async () => {
    const deps = buildDeps()
    deps.pageRepository.seed(buildTestPage({ id: 'page1', slug: 'draft-page', status: 'draft' }))

    expect(await buildStorefrontPage('draft-page', deps, 'published')).toBeNull()
    expect(await buildStorefrontPage('draft-page', deps)).not.toBeNull()
  })

  it('falls back to a "none" hero shape when the page has no hero', async () => {
    const deps = buildDeps()
    deps.pageRepository.seed(buildTestPage({ id: 'page1', slug: 'no-hero', hero: null }))

    const result = await buildStorefrontPage('no-hero', deps)

    expect(result?.hero).toMatchObject({ type: 'none' })
  })
})
