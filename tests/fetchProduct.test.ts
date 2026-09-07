// tests/fetchProduct.test.ts
import { describe, expect, it } from 'vitest'
import { buildStorefrontProduct } from '../src/app/_api/fetchProduct'
import { buildTestCategory, FakeCategoryRepository } from './fakes/FakeCategoryRepository'
import { buildTestMedia, FakeMediaRepository } from './fakes/FakeMediaRepository'
import { FakePageRepository } from './fakes/FakePageRepository'
import { buildTestProduct, FakeProductRepository } from './fakes/FakeProductRepository'

const buildDeps = () => ({
  productRepository: new FakeProductRepository(),
  categoryRepository: new FakeCategoryRepository(),
  mediaRepository: new FakeMediaRepository(),
  pageRepository: new FakePageRepository(),
})

describe('buildStorefrontProduct', () => {
  it('resolves categories, meta image, layout, and related products for the Product detail page', async () => {
    const deps = buildDeps()

    deps.categoryRepository.seed(buildTestCategory({ id: 'cat1', title: 'Footwear' }))
    deps.mediaRepository.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/boots.jpg' }))

    deps.productRepository.seed(
      buildTestProduct({
        id: 'related1',
        slug: 'trail-socks',
        title: 'Trail Socks',
        price: 999,
        currency: 'USD',
      }),
    )

    deps.productRepository.seed(
      buildTestProduct({
        id: 'prod1',
        slug: 'trail-boots',
        title: 'Trail Boots',
        categories: ['cat1'],
        relatedProducts: ['related1'],
        price: 4999,
        currency: 'USD',
        meta: { title: 'Trail Boots', description: 'Rugged.', imageId: 'media1' },
        layout: [{ blockType: 'cta', richText: [], links: [] }],
      }),
    )

    const result = await buildStorefrontProduct('trail-boots', deps)

    expect(result).toMatchObject({
      id: 'prod1',
      slug: 'trail-boots',
      title: 'Trail Boots',
      price: { amount: 4999, currency: 'USD' },
      categories: [{ id: 'cat1', title: 'Footwear' }],
      meta: { image: expect.objectContaining({ id: 'media1' }) },
    })
    expect(result?.layout).toEqual([{ blockType: 'cta', richText: [], links: [] }])
    expect(result?.relatedProducts).toEqual([
      expect.objectContaining({
        id: 'related1',
        slug: 'trail-socks',
        title: 'Trail Socks',
        price: { amount: 999, currency: 'USD' },
      }),
    ])
  })

  it('returns null when no product matches the slug (matches fetchDoc\'s not-found behavior)', async () => {
    const result = await buildStorefrontProduct('does-not-exist', buildDeps())
    expect(result).toBeNull()
  })

  it('respects the status filter the same way fetchDoc\'s `draft` flag does', async () => {
    const deps = buildDeps()
    deps.productRepository.seed(
      buildTestProduct({ id: 'prod1', slug: 'draft-item', status: 'draft' }),
    )

    expect(await buildStorefrontProduct('draft-item', deps, 'published')).toBeNull()
    expect(await buildStorefrontProduct('draft-item', deps)).not.toBeNull()
  })

  it('silently drops a category/relatedProduct reference that no longer resolves', async () => {
    const deps = buildDeps()
    deps.productRepository.seed(
      buildTestProduct({
        id: 'prod1',
        slug: 'orphaned',
        categories: ['missing-category'],
        relatedProducts: ['missing-product'],
      }),
    )

    const result = await buildStorefrontProduct('orphaned', deps)

    expect(result?.categories).toEqual([])
    expect(result?.relatedProducts).toEqual([])
  })

  it('never falls back to client/legacy price data for pricing decisions', async () => {
    const deps = buildDeps()
    // Authoritative native price IS set, legacy JSON is null.
    deps.productRepository.seed(
      buildTestProduct({
        id: 'prod1',
        slug: 'priced-natively',
        price: 5999,
        currency: 'USD',
        legacyPriceJSON: null,
      }),
    )

    const result = await buildStorefrontProduct('priced-natively', deps)

    // Display price comes from the authoritative native price only.
    expect(result?.price).toEqual({ amount: 5999, currency: 'USD' })
  })
})
