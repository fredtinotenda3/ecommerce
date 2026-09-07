// tests/productListing.test.ts
//
// The storefront product listing: pagination totals and category
// filtering, against in-memory fakes.
//
// The totals matter because the UI renders "showing 1-10 of N" and a page
// count from them; a total that describes a different filter than the rows
// is worse than no total at all.

import { beforeEach, describe, expect, it } from 'vitest'

import { buildStorefrontProductList } from '../src/app/_api/fetchProduct'
import { FakeMediaRepository, buildTestMedia } from './fakes/FakeMediaRepository'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'

describe('buildStorefrontProductList', () => {
  let productRepository: FakeProductRepository
  let mediaRepository: FakeMediaRepository

  const deps = () => ({ productRepository, mediaRepository })

  beforeEach(() => {
    productRepository = new FakeProductRepository()
    mediaRepository = new FakeMediaRepository()

    for (let index = 0; index < 25; index += 1) {
      productRepository.seed(
        buildTestProduct({
          id: `p${index}`,
          slug: `product-${index}`,
          title: `Product ${index}`,
          status: 'published',
          categories: index % 2 === 0 ? ['cat-even'] : ['cat-odd'],
        }),
      )
    }
  })

  it('reports a total and page count that describe the whole result set', async () => {
    const result = await buildStorefrontProductList({ limit: 10, page: 1 }, deps())

    expect(result.docs).toHaveLength(10)
    expect(result.total).toBe(25)
    expect(result.totalPages).toBe(3)
    expect(result.hasNextPage).toBe(true)
    expect(result.hasPrevPage).toBe(false)
  })

  it('reports the last page correctly', async () => {
    const result = await buildStorefrontProductList({ limit: 10, page: 3 }, deps())

    expect(result.docs).toHaveLength(5)
    expect(result.hasNextPage).toBe(false)
    expect(result.hasPrevPage).toBe(true)
  })

  it('clamps a page beyond the end to the last page rather than 404ing', async () => {
    const result = await buildStorefrontProductList({ limit: 10, page: 99 }, deps())

    expect(result.page).toBe(3)
    expect(result.docs).toHaveLength(5)
  })

  it('counts against the same filter it pages through', async () => {
    const result = await buildStorefrontProductList(
      { limit: 5, page: 1, categoryIds: ['cat-even'] },
      deps(),
    )

    expect(result.total).toBe(13)
    expect(result.totalPages).toBe(3)
    expect(result.docs).toHaveLength(5)
  })

  it('filters as a union across several categories', async () => {
    const result = await buildStorefrontProductList(
      { limit: 100, page: 1, categoryIds: ['cat-even', 'cat-odd'] },
      deps(),
    )

    expect(result.total).toBe(25)
  })

  it('never lists an unpublished product', async () => {
    productRepository.seed(
      buildTestProduct({ id: 'draft1', slug: 'secret', status: 'draft', categories: ['cat-even'] }),
    )

    const result = await buildStorefrontProductList({ limit: 100 }, deps())

    expect(result.total).toBe(25)
    expect(result.docs.some(doc => doc.slug === 'secret')).toBe(false)
  })

  it('reports an empty result set without pretending there is a page', async () => {
    const result = await buildStorefrontProductList({ categoryIds: ['nothing-here'] }, deps())

    expect(result.total).toBe(0)
    expect(result.totalPages).toBe(0)
    expect(result.docs).toEqual([])
    expect(result.hasNextPage).toBe(false)
  })

  it('caps the page size so a caller cannot ask for the whole catalogue', async () => {
    const result = await buildStorefrontProductList({ limit: 10_000 }, deps())

    expect(result.limit).toBe(100)
  })

  it('resolves each card image', async () => {
    mediaRepository.seed(buildTestMedia({ id: 'media1', url: '/media/photo.png' }))
    productRepository.seed(
      buildTestProduct({
        id: 'withImage',
        slug: 'with-image',
        status: 'published',
        meta: { title: undefined, description: undefined, imageId: 'media1' },
      }),
    )

    const result = await buildStorefrontProductList({ limit: 100 }, deps())
    const card = result.docs.find(doc => doc.slug === 'with-image')

    expect(card?.meta?.image).toMatchObject({ url: '/media/photo.png' })
  })
})
