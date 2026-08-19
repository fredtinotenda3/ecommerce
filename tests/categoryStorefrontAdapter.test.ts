// tests/categoryStorefrontAdapter.test.ts
import { describe, expect, it } from 'vitest'
import { toStorefrontCategory } from '../src/lib/repositories/adapters/categoryStorefrontAdapter'
import { buildTestCategory } from './fakes/FakeCategoryRepository'
import { buildTestMedia } from './fakes/FakeMediaRepository'

describe('toStorefrontCategory', () => {
  it('maps a category with media to the shape Filters/CategoryCard expect', () => {
    const category = buildTestCategory({
      id: 'cat1',
      title: 'Shoes',
      mediaId: 'media1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })
    const media = buildTestMedia({
      id: 'media1',
      alt: 'A shoe',
      url: 'https://cdn.example.com/shoe.jpg',
      width: 400,
      height: 300,
    })

    const result = toStorefrontCategory(category, media)

    expect(result).toEqual({
      id: 'cat1',
      title: 'Shoes',
      media: {
        id: 'media1',
        alt: 'A shoe',
        url: 'https://cdn.example.com/shoe.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        filesize: 1024,
        width: 400,
        height: 300,
        createdAt: media.createdAt.toISOString(),
        updatedAt: media.updatedAt.toISOString(),
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    })
  })

  it('leaves media undefined when the category has no media', () => {
    const category = buildTestCategory({ id: 'cat2', title: 'No Image', mediaId: null })

    const result = toStorefrontCategory(category, null)

    expect(result.media).toBeUndefined()
    expect(result.id).toBe('cat2')
    expect(result.title).toBe('No Image')
  })

  it('leaves media undefined when the referenced media doc cannot be found', () => {
    const category = buildTestCategory({ id: 'cat3', title: 'Broken Reference', mediaId: 'missing-media' })

    const result = toStorefrontCategory(category, null)

    expect(result.media).toBeUndefined()
  })
})
