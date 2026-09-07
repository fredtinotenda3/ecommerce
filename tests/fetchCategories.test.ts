// tests/fetchCategories.test.ts
import { describe, expect, it } from 'vitest'
import { buildStorefrontCategories } from '../src/app/_api/fetchCategories'
import { buildTestCategory, FakeCategoryRepository } from './fakes/FakeCategoryRepository'
import { buildTestMedia, FakeMediaRepository } from './fakes/FakeMediaRepository'

describe('buildStorefrontCategories', () => {
  it('resolves media for each category and matches the GraphQL CATEGORIES query shape', async () => {
    const categoryRepo = new FakeCategoryRepository()
    const mediaRepo = new FakeMediaRepository()

    categoryRepo.seed(buildTestCategory({ id: 'cat1', title: 'Shoes', mediaId: 'media1' }))
    categoryRepo.seed(buildTestCategory({ id: 'cat2', title: 'Hats', mediaId: null }))
    mediaRepo.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/shoe.jpg' }))

    const result = await buildStorefrontCategories(categoryRepo, mediaRepo)

    expect(result).toHaveLength(2)

    const shoes = result.find(c => c.id === 'cat1')
    expect(shoes?.title).toBe('Shoes')
    expect(shoes?.media).toMatchObject({ id: 'media1', url: 'https://cdn.example.com/shoe.jpg' })

    const hats = result.find(c => c.id === 'cat2')
    expect(hats?.title).toBe('Hats')
    expect(hats?.media).toBeUndefined()
  })

  it('does not throw and omits media when a category references a media id that no longer exists', async () => {
    const categoryRepo = new FakeCategoryRepository()
    const mediaRepo = new FakeMediaRepository()
    categoryRepo.seed(buildTestCategory({ id: 'cat1', title: 'Orphaned', mediaId: 'does-not-exist' }))

    const result = await buildStorefrontCategories(categoryRepo, mediaRepo)

    expect(result).toEqual([
      expect.objectContaining({ id: 'cat1', title: 'Orphaned', media: undefined }),
    ])
  })

  it('returns an empty array when there are no categories', async () => {
    const result = await buildStorefrontCategories(new FakeCategoryRepository(), new FakeMediaRepository())
    expect(result).toEqual([])
  })
})
