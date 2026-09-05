// tests/cartProductViewModel.test.ts
//
// PHASE 13P — regression tests for the `StorefrontCartProduct` view model
// added to src/app/_types/storefront.ts, and for the `CartItem`/`CartType`
// types in src/app/_providers/Cart/reducer.ts (now defined independently
// of payload-types.ts's generated `CartItems`/`User['cart']`, per that
// file's header comment).
//
// Three things are worth locking in here:
//
// 1. A real `payload-types.ts` `Product` still satisfies the narrowed
//    `StorefrontCartProduct` unchanged (same rationale as every prior
//    phase's `Storefront*` type-level test: the literal below only
//    type-checks if that relationship holds, so a future edit that breaks
//    it fails `npm run test`'s `tsc`-backed collection step the same as
//    `npx tsc --noEmit` would).
// 2. A real `payload-types.ts` `CartItems` array (and therefore a real
//    `User['cart']`) still satisfies the reducer's own `CartItem[]` /
//    `CartType`, even though those are no longer type aliases of the
//    generated types — this is what makes the Phase 13P migration safe
//    with no changes anywhere else that constructs/fetches a cart.
// 3. `cartReducer`'s actual runtime behavior (ADD_ITEM / DELETE_ITEM /
//    MERGE_CART / CLEAR_CART — matching, quantity updates, dedup) is
//    unchanged for normal operations, exercised with real `Product`-shaped
//    values passed through the narrower types.

import { describe, expect, it } from 'vitest'

import { cartReducer } from '../src/app/_providers/Cart/reducer'
import type { CartItem, CartType } from '../src/app/_providers/Cart/reducer'
import type { StorefrontCartProduct } from '../src/app/_types/storefront'
import type { CartItems, Product as PayloadProduct, User } from '../src/payload/payload-types'

const buildPayloadProduct = (overrides: Partial<PayloadProduct> = {}): PayloadProduct => ({
  id: 'product-1',
  title: 'Test Product',
  slug: 'test-product',
  stripeProductID: 'prod_123',
  priceJSON: JSON.stringify({ data: [{ unit_amount: 1000, type: 'one_time' }] }),
  meta: {
    title: 'Test Product',
    description: 'A product for testing',
    image: 'media-1',
  },
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('StorefrontCartProduct (Phase 13P)', () => {
  it('accepts a minimal object with only the fields Cart-coupled code reads', () => {
    const product: StorefrontCartProduct = {
      id: 'product-1',
      title: 'Test Product',
    }
    expect(product.id).toBe('product-1')
    expect(product.slug).toBeUndefined()
    expect(product.meta).toBeUndefined()
  })

  it('accepts a real payload-types.ts Product object unchanged (extra fields ignored)', () => {
    const payloadProduct = buildPayloadProduct()

    const product: StorefrontCartProduct = payloadProduct
    expect(product.id).toBe('product-1')
    expect(product.title).toBe('Test Product')
    expect(product.slug).toBe('test-product')
    expect(product.priceJSON).toBe(payloadProduct.priceJSON)
  })

  it('accepts meta.image as either a media id string or a populated object', () => {
    const withStringImage: StorefrontCartProduct = {
      id: 'p1',
      title: 'P1',
      meta: { image: 'media-id' },
    }
    const withObjectImage: StorefrontCartProduct = {
      id: 'p2',
      title: 'P2',
      meta: { image: { url: 'https://example.com/p2.jpg' } },
    }
    expect(withStringImage.meta?.image).toBe('media-id')
    expect(
      typeof withObjectImage.meta?.image === 'object' && withObjectImage.meta?.image?.url,
    ).toBe('https://example.com/p2.jpg')
  })
})

describe('Cart reducer CartItem/CartType decoupling (Phase 13P)', () => {
  it('accepts a real payload-types.ts CartItems array as the reducer CartType (unchanged)', () => {
    const payloadProduct = buildPayloadProduct()

    const realCartItems: CartItems = [{ product: payloadProduct, quantity: 2, id: 'line-1' }]

    // This is the crux of the "safe to narrow" claim: a value typed
    // against the full, generated `CartItems` (product: string | Product)
    // is assignable to the reducer's own, independently-defined
    // `CartType` (product: string | StorefrontCartProduct) with no cast.
    const cart: CartType = { items: realCartItems }

    expect(cart?.items?.[0]?.quantity).toBe(2)
  })

  it("accepts a real payload-types.ts User['cart'] value unchanged", () => {
    const payloadProduct = buildPayloadProduct({ id: 'product-2' })

    const userCart: User['cart'] = {
      items: [{ product: payloadProduct, quantity: 1 }],
    }

    const cart: CartType = userCart
    expect(cart?.items?.[0]?.product).toEqual(payloadProduct)
  })
})

describe('cartReducer behavior is unchanged for normal operations (Phase 13P)', () => {
  const productA: StorefrontCartProduct = buildPayloadProduct({ id: 'a', title: 'Product A' })
  const productB: StorefrontCartProduct = buildPayloadProduct({ id: 'b', title: 'Product B' })

  it('ADD_ITEM adds a new item to an empty cart', () => {
    const result = cartReducer(
      { items: [] },
      { type: 'ADD_ITEM', payload: { product: productA, quantity: 1 } },
    )
    expect(result?.items).toHaveLength(1)
    expect(result?.items?.[0]?.product).toEqual(productA)
    expect(result?.items?.[0]?.quantity).toBe(1)
  })

  it('ADD_ITEM updates the quantity of an existing item rather than duplicating it', () => {
    const withA: CartType = { items: [{ product: productA, quantity: 1 }] }
    const result = cartReducer(withA, {
      type: 'ADD_ITEM',
      payload: { product: productA, quantity: 5 },
    })
    expect(result?.items).toHaveLength(1)
    expect(result?.items?.[0]?.quantity).toBe(5)
  })

  it('ADD_ITEM treats different products as separate lines', () => {
    const withA: CartType = { items: [{ product: productA, quantity: 1 }] }
    const result = cartReducer(withA, {
      type: 'ADD_ITEM',
      payload: { product: productB, quantity: 2 },
    })
    expect(result?.items).toHaveLength(2)
  })

  it('DELETE_ITEM removes the matching line by id', () => {
    const withBoth: CartType = {
      items: [
        { product: productA, quantity: 1 },
        { product: productB, quantity: 2 },
      ],
    }
    const result = cartReducer(withBoth, { type: 'DELETE_ITEM', payload: productA })
    expect(result?.items).toHaveLength(1)
    expect(result?.items?.[0]?.product).toEqual(productB)
  })

  it('DELETE_ITEM matches a bare product-id string line the same as an object line', () => {
    const withStringLine: CartType = { items: [{ product: 'a', quantity: 1 }] }
    const result = cartReducer(withStringLine, { type: 'DELETE_ITEM', payload: productA })
    expect(result?.items).toHaveLength(0)
  })

  it('CLEAR_CART empties the items array', () => {
    const withA: CartType = { items: [{ product: productA, quantity: 1 }] }
    const result = cartReducer(withA, { type: 'CLEAR_CART' })
    expect(result?.items).toEqual([])
  })

  it('MERGE_CART de-duplicates by product id across the two carts', () => {
    const local: CartType = { items: [{ product: productA, quantity: 1 }] }
    const incoming: CartType = {
      items: [
        { product: productA, quantity: 1 },
        { product: productB, quantity: 3 },
      ],
    }
    const result = cartReducer(local, { type: 'MERGE_CART', payload: incoming })
    expect(result?.items).toHaveLength(2)
  })
})
