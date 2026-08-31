// tests/fetchPaywallNative.test.ts
//
// Unit tests for src/app/_api/fetchPaywallNative.ts's deps-injectable
// functions (canReadPaywall, resolvePaywallBlocks), using fakes so no
// database is required — same pattern as fetchProductNative.test.ts /
// layoutRelationsAdapter.test.ts.

import { describe, expect, it } from 'vitest'

import { canReadPaywall, resolvePaywallBlocks } from '../src/app/_api/fetchPaywallNative'
import { FakeMediaRepository } from './fakes/FakeMediaRepository'
import { FakePageRepository } from './fakes/FakePageRepository'
import { buildTestProduct, FakeProductRepository } from './fakes/FakeProductRepository'

describe('canReadPaywall', () => {
  it('denies an anonymous (null) requester', () => {
    expect(canReadPaywall(null, 'product_1')).toBe(false)
  })

  it('allows an admin regardless of purchases', () => {
    expect(
      canReadPaywall({ id: 'user_1', roles: ['admin'], purchases: [] }, 'product_1'),
    ).toBe(true)
  })

  it('allows a customer who purchased the product', () => {
    expect(
      canReadPaywall(
        { id: 'user_1', roles: ['customer'], purchases: ['product_1'] },
        'product_1',
      ),
    ).toBe(true)
  })

  it('denies a customer who has not purchased the product', () => {
    expect(
      canReadPaywall(
        { id: 'user_1', roles: ['customer'], purchases: ['product_2'] },
        'product_1',
      ),
    ).toBe(false)
  })
})

describe('resolvePaywallBlocks', () => {
  const buildDeps = () => ({
    productRepository: new FakeProductRepository(),
    mediaRepository: new FakeMediaRepository(),
    pageRepository: new FakePageRepository(),
  })

  it('returns null when the product does not exist', async () => {
    const deps = buildDeps()
    const result = await resolvePaywallBlocks('missing-slug', null, deps)
    expect(result).toBeNull()
  })

  it('returns null for an anonymous requester, even if the product has paywall content', async () => {
    const deps = buildDeps()
    ;(deps.productRepository as FakeProductRepository).seed(
      buildTestProduct({
        slug: 'gated-product',
        status: 'published',
        paywall: [{ blockType: 'content', columns: [] }],
      }),
    )

    const result = await resolvePaywallBlocks('gated-product', null, deps)
    expect(result).toBeNull()
  })

  it('returns null for a logged-in user who has not purchased the product', async () => {
    const deps = buildDeps()
    const product = buildTestProduct({
      slug: 'gated-product',
      status: 'published',
      paywall: [{ blockType: 'content', columns: [] }],
    })
    ;(deps.productRepository as FakeProductRepository).seed(product)

    const result = await resolvePaywallBlocks(
      'gated-product',
      { id: 'user_1', roles: ['customer'], purchases: [] },
      deps,
    )
    expect(result).toBeNull()
  })

  it('resolves and returns paywall blocks for a user who purchased the product', async () => {
    const deps = buildDeps()
    const product = buildTestProduct({
      slug: 'gated-product',
      status: 'published',
      paywall: [{ blockType: 'content', columns: [] }],
    })
    ;(deps.productRepository as FakeProductRepository).seed(product)

    const result = await resolvePaywallBlocks(
      'gated-product',
      { id: 'user_1', roles: ['customer'], purchases: [product.id] },
      deps,
    )

    expect(result).toEqual([{ blockType: 'content', columns: [] }])
  })

  it('resolves and returns paywall blocks for an admin, regardless of purchases', async () => {
    const deps = buildDeps()
    const product = buildTestProduct({
      slug: 'gated-product',
      status: 'published',
      paywall: [{ blockType: 'content', columns: [] }],
    })
    ;(deps.productRepository as FakeProductRepository).seed(product)

    const result = await resolvePaywallBlocks(
      'gated-product',
      { id: 'admin_1', roles: ['admin'], purchases: [] },
      deps,
    )

    expect(result).toEqual([{ blockType: 'content', columns: [] }])
  })
})
