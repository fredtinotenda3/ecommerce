// tests/pricing.test.ts
import { describe, expect, it } from 'vitest'
import {
  computeSubtotal,
  computeTotal,
  EmptyCartError,
  generateMerchantReference,
  generateOrderNumber,
  ProductNotPurchasableError,
  productsToMap,
  resolveOrderItems,
} from '../src/lib/services/pricing'
import { buildTestProduct } from './fakes/FakeProductRepository'

describe('resolveOrderItems — server-authoritative pricing', () => {
  it('CLIENT PRICE != AUTHORITATIVE DATABASE PRICE: the resolved order item always uses the product repository price, never any price supplied alongside the cart item', () => {
    const product = buildTestProduct({ id: 'p1', price: 1999, currency: 'USD' })
    const productsById = productsToMap([product])

    // Note: CartItem has no `price` field at all in the domain model —
    // this test's intent is that even if a caller tried to smuggle a
    // tampered total through some other channel, resolveOrderItems has
    // no code path that would ever read it. The only source of truth is
    // the resolved Product.
    const items = resolveOrderItems([{ productId: 'p1', quantity: 2 }], productsById)

    expect(items).toHaveLength(1)
    expect(items[0].unitPrice).toBe(1999) // the DB price, not something the client sent
    expect(items[0].currency).toBe('USD')
    expect(items[0].quantity).toBe(2)
  })

  it('throws EmptyCartError for an empty cart', () => {
    expect(() => resolveOrderItems([], new Map())).toThrow(EmptyCartError)
  })

  it('throws ProductNotPurchasableError for a product with no authoritative price set', () => {
    const product = buildTestProduct({ id: 'p1', price: null, currency: null })
    const productsById = productsToMap([product])

    expect(() => resolveOrderItems([{ productId: 'p1', quantity: 1 }], productsById)).toThrow(
      ProductNotPurchasableError,
    )
  })

  it('throws ProductNotPurchasableError for an unpublished (draft) product', () => {
    const product = buildTestProduct({ id: 'p1', status: 'draft' })
    const productsById = productsToMap([product])

    expect(() => resolveOrderItems([{ productId: 'p1', quantity: 1 }], productsById)).toThrow(
      ProductNotPurchasableError,
    )
  })

  it('throws ProductNotPurchasableError for a product not found in the resolved map', () => {
    expect(() =>
      resolveOrderItems([{ productId: 'missing', quantity: 1 }], new Map()),
    ).toThrow(ProductNotPurchasableError)
  })

  it('throws ProductNotPurchasableError for an invalid (zero/negative/non-integer) quantity', () => {
    const product = buildTestProduct({ id: 'p1' })
    const productsById = productsToMap([product])

    expect(() =>
      resolveOrderItems([{ productId: 'p1', quantity: 0 }], productsById),
    ).toThrow(ProductNotPurchasableError)
    expect(() =>
      resolveOrderItems([{ productId: 'p1', quantity: 1.5 }], productsById),
    ).toThrow(ProductNotPurchasableError)
  })
})

describe('computeSubtotal / computeTotal', () => {
  it('sums line items correctly', () => {
    const items = resolveOrderItems(
      [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
      productsToMap([
        buildTestProduct({ id: 'p1', price: 1000, currency: 'USD' }),
        buildTestProduct({ id: 'p2', price: 2500, currency: 'USD' }),
      ]),
    )

    const subtotal = computeSubtotal(items, 'USD')
    expect(subtotal.amount).toBe(2 * 1000 + 2500)

    const total = computeTotal(subtotal)
    expect(total.amount).toBe(subtotal.amount)
  })

  it('rejects a cart mixing currencies', () => {
    const items = resolveOrderItems(
      [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
      ],
      productsToMap([
        buildTestProduct({ id: 'p1', price: 1000, currency: 'USD' }),
        buildTestProduct({ id: 'p2', price: 1000, currency: 'ZWL' }),
      ]),
    )

    expect(() => computeSubtotal(items, 'USD')).toThrow()
  })
})

describe('generateOrderNumber / generateMerchantReference', () => {
  it('produces a stable, parseable order number format', () => {
    const orderNumber = generateOrderNumber(new Date('2026-08-16T00:00:00Z'))
    expect(orderNumber).toMatch(/^ORD-260816-[0-9A-F]{8}$/)
  })

  it('generates distinct order numbers across calls (collision rarity, not a hard guarantee — DB enforces uniqueness)', () => {
    const numbers = new Set(Array.from({ length: 50 }, () => generateOrderNumber()))
    expect(numbers.size).toBe(50)
  })

  it('merchant reference equals the order number for the first attempt', () => {
    expect(generateMerchantReference('ORD-260816-ABCD1234')).toBe('ORD-260816-ABCD1234')
  })

  it('merchant reference is distinct for retry attempts', () => {
    expect(generateMerchantReference('ORD-260816-ABCD1234', 2)).toBe('ORD-260816-ABCD1234-R2')
  })
})
