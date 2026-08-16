// tests/cartService.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { CartService } from '../src/lib/services/CartService'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'

describe('CartService.validateCart', () => {
  let productRepo: FakeProductRepository
  let service: CartService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    service = new CartService(productRepo)
  })

  it('returns an empty result for an empty cart', async () => {
    const result = await service.validateCart([])
    expect(result.validItems).toEqual([])
    expect(result.subtotal).toBeNull()
  })

  it('prices valid items from the database, not from anything the caller supplies', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', price: 500, currency: 'USD' }))

    const result = await service.validateCart([{ productId: 'p1', quantity: 3 }])

    expect(result.validItems).toHaveLength(1)
    expect(result.validItems[0].unitPrice).toBe(500)
    expect(result.subtotal).toEqual({ amount: 1500, currency: 'USD' })
    expect(result.unavailableProductIds).toEqual([])
  })

  it('drops products that no longer exist and reports them as unavailable', async () => {
    const result = await service.validateCart([{ productId: 'missing', quantity: 1 }])
    expect(result.validItems).toEqual([])
    expect(result.unavailableProductIds).toEqual(['missing'])
  })

  it('drops unpublished products', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', status: 'draft' }))
    const result = await service.validateCart([{ productId: 'p1', quantity: 1 }])
    expect(result.unavailableProductIds).toEqual(['p1'])
  })

  it('drops products with no authoritative price set', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', price: null, currency: null }))
    const result = await service.validateCart([{ productId: 'p1', quantity: 1 }])
    expect(result.unavailableProductIds).toEqual(['p1'])
  })

  it('keeps valid items even when some other item in the cart is unavailable', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', price: 1000, currency: 'USD' }))

    const result = await service.validateCart([
      { productId: 'p1', quantity: 1 },
      { productId: 'missing', quantity: 1 },
    ])

    expect(result.validItems).toHaveLength(1)
    expect(result.unavailableProductIds).toEqual(['missing'])
    expect(result.subtotal).toEqual({ amount: 1000, currency: 'USD' })
  })

  it('fails safe on a mixed-currency cart: reports everything as unavailable rather than guessing', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', price: 1000, currency: 'USD' }))
    productRepo.seed(buildTestProduct({ id: 'p2', price: 1000, currency: 'ZWL' }))

    const result = await service.validateCart([
      { productId: 'p1', quantity: 1 },
      { productId: 'p2', quantity: 1 },
    ])

    expect(result.validItems).toEqual([])
    expect(result.subtotal).toBeNull()
    expect(result.unavailableProductIds.sort()).toEqual(['p1', 'p2'])
  })
})
