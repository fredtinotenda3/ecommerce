// tests/productHeroViewModel.test.ts
//
// PHASE 13U — type-level regression tests for the `StorefrontProductHeroView`
// view model added to src/app/_types/storefront.ts, and for `ProductHero`'s
// (`src/app/_heros/Product/index.tsx`) narrowed prop type built from it.
//
// These types have no runtime behavior of their own (same rationale as
// every prior phase's `Storefront*` type-level test, e.g.
// `tests/cartProductViewModel.test.ts`, Phase 13P) — what matters is that
// the relationship this phase depends on stays true: a future edit that
// breaks it fails `npm run test`'s `tsc`-backed collection step the same
// way a plain `npx tsc --noEmit` would, not silently.
//
// Two things are proved here:
//   1. A real `payload-types.ts` `Product` still satisfies the narrowed
//      `StorefrontProductHeroView` unchanged — narrowing the view model
//      didn't narrow what data can flow into it.
//   2. `ProductHero` itself still accepts a real `payload-types.ts`
//      `Product` unchanged, with no caller-side edits — this is what
//      `src/app/(pages)/products/[slug]/page.tsx`'s
//      `<ProductHero product={product} />` (still a `PayloadProduct`, per
//      `buildStorefrontProduct`'s still-unchanged public return type)
//      relies on.

import { describe, expect, it } from 'vitest'

import { ProductHero } from '../src/app/_heros/Product'
import type {
  StorefrontProductCategoryRef,
  StorefrontProductHeroView,
} from '../src/app/_types/storefront'
import type { Product as PayloadProduct } from '../src/payload/payload-types'

const buildPayloadProduct = (overrides: Partial<PayloadProduct> = {}): PayloadProduct => ({
  id: 'product-1',
  title: 'Trail Boots',
  slug: 'trail-boots',
  stripeProductID: 'prod_123',
  priceJSON: JSON.stringify({ data: [{ unit_amount: 4999, type: 'one_time' }] }),
  categories: [{ id: 'cat1', title: 'Footwear' } as unknown as string],
  meta: {
    title: 'Trail Boots | Store',
    description: 'Rugged trail boots.',
    image: { id: 'media1', url: 'https://cdn.example.com/boots.jpg' } as unknown as string,
  },
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('StorefrontProductHeroView (Phase 13U)', () => {
  it('accepts a minimal object with only the fields ProductHero reads', () => {
    const product: StorefrontProductHeroView = {
      id: 'product-1',
      title: 'Trail Boots',
    }
    expect(product.id).toBe('product-1')
    expect(product.categories).toBeUndefined()
    expect(product.meta).toBeUndefined()
  })

  it('accepts a real payload-types.ts Product object unchanged (extra fields ignored)', () => {
    const payloadProduct = buildPayloadProduct()

    const product: StorefrontProductHeroView = payloadProduct
    expect(product.id).toBe('product-1')
    expect(product.title).toBe('Trail Boots')
    expect(product.priceJSON).toBe(payloadProduct.priceJSON)
    expect(product.categories).toHaveLength(1)
  })

  it('accepts categories as either bare id strings or resolved category refs', () => {
    const withStringCategories: StorefrontProductHeroView = {
      id: 'p1',
      title: 'P1',
      categories: ['cat1', 'cat2'],
    }
    const withResolvedCategories: StorefrontProductHeroView = {
      id: 'p2',
      title: 'P2',
      categories: [{ id: 'cat1', title: 'Footwear' }],
    }
    expect(withStringCategories.categories).toEqual(['cat1', 'cat2'])
    expect(
      (withResolvedCategories.categories?.[0] as StorefrontProductCategoryRef).title,
    ).toBe('Footwear')
  })

  it('accepts meta.description without requiring meta.image', () => {
    const product: StorefrontProductHeroView = {
      id: 'p1',
      title: 'P1',
      meta: { description: 'A description.' },
    }
    expect(product.meta?.description).toBe('A description.')
  })
})

describe('ProductHero prop type (Phase 13U)', () => {
  it('accepts a real payload-types.ts Product object unchanged', () => {
    const payloadProduct = buildPayloadProduct()

    // This is exactly what `src/app/(pages)/products/[slug]/page.tsx` does
    // today: pass the fetched product straight into
    // `<ProductHero product={...} />` — this only type-checks if
    // `ProductHero`'s narrowed prop type still accepts a real, full
    // `payload-types.ts` `Product` with no cast.
    const props: Parameters<typeof ProductHero>[0] = { product: payloadProduct }
    expect(props.product.id).toBe('product-1')
    expect(props.product.title).toBe('Trail Boots')
  })

  it('accepts a Product with an unresolved (string) meta.image', () => {
    const payloadProduct = buildPayloadProduct({ meta: { image: 'media-id' } })

    const props: Parameters<typeof ProductHero>[0] = { product: payloadProduct }
    expect(props.product.meta?.image).toBe('media-id')
  })

  it('accepts a Product with no meta at all', () => {
    const payloadProduct = buildPayloadProduct({ meta: undefined })

    const props: Parameters<typeof ProductHero>[0] = { product: payloadProduct }
    expect(props.product.meta).toBeUndefined()
  })
})
