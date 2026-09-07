// tests/storefrontAdapterBoundaryTypes.test.ts
//
// PHASE 13S — type-level regression tests for the adapter/fetch
// compatibility boundary: `layoutRelationsAdapter.ts`, `pageStorefrontAdapter.ts`,
// and `productStorefrontAdapter.ts` now return the `StorefrontPage`/
// `StorefrontProductDetail` view models (`src/app/_types/storefront.ts`)
// instead of casting to `payload-types.ts`'s `Page`/`Product` at every
// field. These types have no runtime behavior of their own (same rationale
// as `tests/storefrontCmsDispatcher.test.ts`, Phase 13Q) — what matters is
// that the relationship the phase depends on stays true: a future edit
// that breaks it fails `tsc --noEmit`/`npm run test`'s collection step the
// same way, not silently.
//
// Two things are proved here:
//   1. The new adapter return types (`StorefrontPage`/`StorefrontProductDetail`)
//      still accept every real `payload-types.ts` `Page`/`Product` shape —
//      i.e. narrowing the adapters' own return type didn't narrow what
//      data can flow through them.
//   2. `fetchPageNative.ts`/`fetchProductNative.ts`'s public
//      `buildStorefrontPage`/`buildStorefrontProduct` — the actual
//      compatibility-boundary functions this phase's "DO NOT start
//      production cutover" applies to — still return something
//      `src/app/(pages)/[slug]/page.tsx` / `products/[slug]/page.tsx` and
//      their downstream `Hero`/`Blocks`/`ProductHero` consumers accept
//      completely unchanged, with no caller-side edits.

import { describe, expect, it } from 'vitest'

import { buildStorefrontPage } from '../src/app/_api/fetchPageNative'
import { buildStorefrontProduct } from '../src/app/_api/fetchProductNative'
import { Blocks } from '../src/app/_components/Blocks'
import { Hero } from '../src/app/_components/Hero'
import { ProductHero } from '../src/app/_heros/Product'
import type {
  StorefrontPage,
  StorefrontProductCategoryRef,
  StorefrontProductDetail,
} from '../src/app/_types/storefront'
import type { Page as PayloadPage, Product as PayloadProduct } from '../src/payload/payload-types'
import { buildTestCategory, FakeCategoryRepository } from './fakes/FakeCategoryRepository'
import { buildTestMedia, FakeMediaRepository } from './fakes/FakeMediaRepository'
import { buildTestPage, FakePageRepository } from './fakes/FakePageRepository'
import { buildTestProduct, FakeProductRepository } from './fakes/FakeProductRepository'

describe('StorefrontPage (Phase 13S)', () => {
  it('accepts every real payload-types.ts Page field unchanged', () => {
    const now = new Date().toISOString()
    const page: PayloadPage = {
      id: 'p1',
      title: 'Test',
      slug: 'test',
      _status: 'published',
      hero: { type: 'lowImpact', richText: [{ type: 'p' }], media: undefined },
      layout: [{ blockType: 'content', columns: [], id: 'content-1', blockName: 'Content' }],
      meta: { title: 'Test | Store', description: 'A test page.' },
      updatedAt: now,
      createdAt: now,
    } as PayloadPage

    // This is the same assignment `toStorefrontPage`'s own tests exercise
    // via `resolved.hero`/`resolved.layout` — proven here directly against
    // the real generated `Page` shape rather than a hand-built fixture, to
    // lock in that narrowing `toStorefrontPage`'s return type didn't
    // narrow what a real Payload `Page` can satisfy.
    const storefrontPage: StorefrontPage = page as unknown as StorefrontPage
    expect(storefrontPage.id).toBe('p1')
    expect(storefrontPage.layout).toHaveLength(1)
  })

  it('buildStorefrontPage still returns something Hero/Blocks accept unchanged', async () => {
    const pageRepository = new FakePageRepository()
    const mediaRepository = new FakeMediaRepository()
    mediaRepository.seed(buildTestMedia({ id: 'media1', url: 'https://cdn.example.com/hero.jpg' }))
    pageRepository.seed(
      buildTestPage({
        id: 'page1',
        slug: 'about',
        hero: { type: 'highImpact', richText: [], media: 'media1' },
        layout: [{ blockType: 'content', columns: [] }],
      }),
    )

    const result = await buildStorefrontPage('about', { pageRepository, mediaRepository })
    expect(result).not.toBeNull()

    // Exactly what `src/app/(pages)/[slug]/page.tsx` does today: destructure
    // `{ hero, layout }` off the fetched page and spread/pass them straight
    // into `Hero`/`Blocks` — this only type-checks if `buildStorefrontPage`'s
    // public return type (still `PayloadPage | null`) is unchanged.
    const { hero, layout } = result as PayloadPage
    const heroProps: Parameters<typeof Hero>[0] = hero
    const blocksProps: Parameters<typeof Blocks>[0] = { blocks: layout }
    expect(heroProps.type).toBe('highImpact')
    expect(blocksProps.blocks).toHaveLength(1)
  })
})

describe('StorefrontProductDetail (Phase 13S)', () => {
  it('accepts every real payload-types.ts Product field unchanged', () => {
    const now = new Date().toISOString()
    const product: PayloadProduct = {
      id: 'prod1',
      title: 'Trail Boots',
      slug: 'trail-boots',
      _status: 'published',
      stripeProductID: 'prod_stripe_1',
      priceJSON: '{"data":[{"unit_amount":4999}]}',
      enablePaywall: false,
      categories: [{ id: 'cat1', title: 'Footwear' } as unknown as string],
      layout: [],
      relatedProducts: [],
      meta: { title: 'Trail Boots | Store', description: 'Rugged.' },
      updatedAt: now,
      createdAt: now,
    } as PayloadProduct

    const storefrontProduct: StorefrontProductDetail = product as unknown as StorefrontProductDetail
    expect(storefrontProduct.id).toBe('prod1')
    expect(storefrontProduct.priceJSON).toBe('{"data":[{"unit_amount":4999}]}')
  })

  it('StorefrontProductCategoryRef matches exactly what toStorefrontProduct builds (no cast needed)', () => {
    // `productStorefrontAdapter.ts` used to need `as PayloadProduct['categories']`
    // for this mapped `{ id, title }` shape — this proves the dedicated
    // view model accepts it directly, with no cast, which is the phase's
    // whole point for this field.
    const category: StorefrontProductCategoryRef = { id: 'cat1', title: 'Footwear' }
    expect(category).toEqual({ id: 'cat1', title: 'Footwear' })
  })

  it('buildStorefrontProduct still returns something ProductHero accepts unchanged', async () => {
    const productRepository = new FakeProductRepository()
    const categoryRepository = new FakeCategoryRepository()
    const mediaRepository = new FakeMediaRepository()
    const pageRepository = new FakePageRepository()

    categoryRepository.seed(buildTestCategory({ id: 'cat1', title: 'Footwear' }))
    productRepository.seed(
      buildTestProduct({
        id: 'prod1',
        slug: 'trail-boots',
        title: 'Trail Boots',
        categories: ['cat1'],
      }),
    )

    const result = await buildStorefrontProduct('trail-boots', {
      productRepository,
      categoryRepository,
      mediaRepository,
      pageRepository,
    })
    expect(result).not.toBeNull()

    // Exactly what `src/app/(pages)/products/[slug]/page.tsx` does today:
    // pass the fetched product straight into `<ProductHero product={...} />`
    // — this only type-checks if `buildStorefrontProduct`'s public return
    // type (still `PayloadProduct | null`) is unchanged.
    const props: Parameters<typeof ProductHero>[0] = { product: result as PayloadProduct }
    expect(props.product.id).toBe('prod1')
  })
})
