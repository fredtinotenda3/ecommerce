// tests/productStorefrontAdapter.test.ts
import { describe, expect, it } from 'vitest'
import { toStorefrontProduct } from '../src/lib/repositories/adapters/productStorefrontAdapter'
import { buildTestMedia } from './fakes/FakeMediaRepository'
import { buildTestProduct } from './fakes/FakeProductRepository'

describe('toStorefrontProduct', () => {
  it('maps a product to the shape ProductHero/Price/AddToCartButton expect', () => {
    const product = buildTestProduct({
      id: 'prod1',
      title: 'Trail Boots',
      slug: 'trail-boots',
      status: 'published',
      enablePaywall: false,
      price: 4999,
      currency: 'USD',
      legacyStripeProductId: 'prod_stripe_1',
      legacyPriceJSON: '{"data":[{"unit_amount":4999,"type":"one_time"}]}',
      meta: { title: 'Trail Boots | Store', description: 'Rugged trail boots.', imageId: 'media1' },
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    })
    const media = buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/boots.jpg' })

    const result = toStorefrontProduct(product, {
      categories: [{ id: 'cat1', title: 'Footwear' }],
      metaImage: media,
      layout: [],
      relatedProducts: [],
    })

    expect(result.id).toBe('prod1')
    expect(result.title).toBe('Trail Boots')
    expect(result.slug).toBe('trail-boots')
    expect(result._status).toBe('published')
    // What ProductHero/Price/AddToCartButton read for display: the
    // authoritative native price, never a legacy value.
    expect(result.price).toEqual({ amount: 4999, currency: 'USD' })
    expect(result.enablePaywall).toBe(false)
    expect(result.categories).toEqual([{ id: 'cat1', title: 'Footwear' }])
    expect(result.meta).toMatchObject({
      title: 'Trail Boots | Store',
      description: 'Rugged trail boots.',
      image: expect.objectContaining({ id: 'media1', url: 'https://cdn.example.com/boots.jpg' }),
    })
  })

  it('exposes no price at all when the product has none, rather than defaulting to zero', () => {
    const product = buildTestProduct({
      price: null,
      currency: null,
      legacyPriceJSON: '{"data":[{"unit_amount":4999,"type":"one_time"}]}',
    })

    const result = toStorefrontProduct(product, {
      categories: [],
      metaImage: null,
      layout: [],
      relatedProducts: [],
    })

    // A product with no authoritative price is not purchasable. It must
    // never fall back to legacy price data, which is display-only history
    // and may not match what the store would actually charge.
    expect(result.price).toBeNull()
  })

  it('omits category breadcrumbs and only forwards id/title (intentionally not resolved)', () => {
    const product = buildTestProduct()

    const result = toStorefrontProduct(product, {
      categories: [{ id: 'cat1', title: 'Footwear' }],
      metaImage: null,
      layout: [],
      relatedProducts: [],
    })

    expect(result.categories).toEqual([{ id: 'cat1', title: 'Footwear' }])
    expect((result.categories?.[0] as unknown as Record<string, unknown>).breadcrumbs).toBeUndefined()
  })

  it('leaves meta.image undefined when there is no meta image', () => {
    const product = buildTestProduct()

    const result = toStorefrontProduct(product, {
      categories: [],
      metaImage: null,
      layout: [],
      relatedProducts: [],
    })

    expect(result.meta?.image).toBeUndefined()
  })

  it('passes already-resolved layout and relatedProducts through untouched', () => {
    const product = buildTestProduct()
    const layout = [{ blockType: 'cta', richText: [] }]
    const relatedProducts = [{ id: 'rel1', slug: 'related-item', title: 'Related Item' } as never]

    const result = toStorefrontProduct(product, {
      categories: [],
      metaImage: null,
      layout,
      relatedProducts,
    })

    expect(result.layout).toBe(layout)
    expect(result.relatedProducts).toBe(relatedProducts)
  })
})
