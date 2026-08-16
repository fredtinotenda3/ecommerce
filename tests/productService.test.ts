// tests/productService.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { ProductService } from '../src/lib/services/ProductService'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'

describe('ProductService.getAuthoritativePrice', () => {
  let productRepo: FakeProductRepository
  let service: ProductService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    service = new ProductService(productRepo)
  })

  it('returns the native price/currency when set', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', price: 2500, currency: 'USD' }))
    const price = await service.getAuthoritativePrice('p1')
    expect(price).toEqual({ amount: 2500, currency: 'USD' })
  })

  it('returns null (never a legacy fallback) when price has not been backfilled yet', async () => {
    productRepo.seed(buildTestProduct({ id: 'p1', price: null, currency: null, legacyPriceJSON: '{"data":[{"unit_amount":999}]}' }))
    const price = await service.getAuthoritativePrice('p1')
    expect(price).toBeNull()
  })

  it('returns null for a non-existent product', async () => {
    const price = await service.getAuthoritativePrice('missing')
    expect(price).toBeNull()
  })
})

describe('ProductService.setPrice', () => {
  let productRepo: FakeProductRepository
  let service: ProductService

  beforeEach(() => {
    productRepo = new FakeProductRepository()
    service = new ProductService(productRepo)
    productRepo.seed(buildTestProduct({ id: 'p1', price: null, currency: null }))
  })

  it('sets the price in minor units', async () => {
    const updated = await service.setPrice('p1', { amount: 1999, currency: 'USD' })
    expect(updated?.price).toBe(1999)
    expect(updated?.currency).toBe('USD')
  })

  it('rejects a non-integer amount (would indicate a major-units float leaking through)', async () => {
    await expect(service.setPrice('p1', { amount: 19.99, currency: 'USD' })).rejects.toThrow()
  })

  it('rejects a negative amount', async () => {
    await expect(service.setPrice('p1', { amount: -100, currency: 'USD' })).rejects.toThrow()
  })
})
