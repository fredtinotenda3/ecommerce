// tests/migrations/orderBackfill.test.ts
import { describe, expect, it } from 'vitest'
import {
  applyItemPatches,
  computeOrderBackfillPatch,
  deriveDeterministicOrderNumber,
  type LegacyOrderInput,
} from '../../scripts/migrations/lib/orderBackfill'

const baseOrder = (overrides: Partial<LegacyOrderInput> = {}): LegacyOrderInput => ({
  id: '507f1f77bcf86cd799439011',
  createdAt: new Date('2023-05-14T10:00:00.000Z'),
  orderNumber: null,
  status: null,
  subtotal: null,
  currency: null,
  total: 4999,
  items: [
    {
      product: '507f1f77bcf86cd799439099',
      title: null,
      price: 4999,
      currency: null,
      quantity: 1,
    },
  ],
  ...overrides,
})

describe('deriveDeterministicOrderNumber', () => {
  it('is deterministic for the same id and date', () => {
    const a = deriveDeterministicOrderNumber('507f1f77bcf86cd799439011', new Date('2023-05-14'))
    const b = deriveDeterministicOrderNumber('507f1f77bcf86cd799439011', new Date('2023-05-14'))
    expect(a).toBe(b)
  })

  it('produces the expected ORD-yymmdd-XXXXXXXX shape', () => {
    const result = deriveDeterministicOrderNumber(
      '507f1f77bcf86cd799439011',
      new Date('2023-05-14T00:00:00.000Z'),
    )
    expect(result).toBe('ORD-230514-99439011')
  })

  it('differs for different ids', () => {
    const a = deriveDeterministicOrderNumber('507f1f77bcf86cd799439011', new Date('2023-05-14'))
    const b = deriveDeterministicOrderNumber('507f1f77bcf86cd799439022', new Date('2023-05-14'))
    expect(a).not.toBe(b)
  })
})

describe('computeOrderBackfillPatch', () => {
  it('backfills orderNumber, status (PAID), currency, subtotal, and item snapshots for a bare legacy order', () => {
    const decision = computeOrderBackfillPatch(baseOrder(), false, new Map([['507f1f77bcf86cd799439099', 'Widget']]))

    expect(decision.action).toBe('migrate')
    const patch = decision.patch!
    expect(patch.status).toBe('PAID')
    expect(patch.currency).toBe('USD')
    expect(patch.subtotal).toBe(4999) // copied from total, never recalculated
    expect(patch.orderNumber).toMatch(/^ORD-\d{6}-[0-9A-F]{8}$/)
    expect(patch.items).toEqual([{ index: 0, title: 'Widget', currency: 'USD' }])
  })

  it('falls back to "Unknown product" when the product title lookup has no entry', () => {
    const decision = computeOrderBackfillPatch(baseOrder(), false, new Map())
    expect(decision.patch!.items).toEqual([{ index: 0, title: 'Unknown product', currency: 'USD' }])
  })

  it('never touches total or item price, even conceptually — the patch shape has no such keys', () => {
    const decision = computeOrderBackfillPatch(baseOrder(), false, new Map())
    const patch = decision.patch!
    expect(patch).not.toHaveProperty('total')
    expect((patch.items ?? [])[0]).not.toHaveProperty('price')
  })

  it('skips an order that already has every target field populated', () => {
    const order = baseOrder({
      orderNumber: 'ORD-230514-AAAAAAAA',
      status: 'PAID',
      subtotal: 4999,
      currency: 'USD',
      items: [
        { product: '507f1f77bcf86cd799439099', title: 'Widget', price: 4999, currency: 'USD', quantity: 1 },
      ],
    })
    const decision = computeOrderBackfillPatch(order, false, new Map())
    expect(decision.action).toBe('skip')
  })

  it('does not overwrite an already-populated currency unless force is passed', () => {
    const order = baseOrder({ currency: 'ZAR' })
    const decision = computeOrderBackfillPatch(order, false, new Map())
    expect(decision.patch?.currency).toBeUndefined()
  })

  it('overwrites fields when force is true', () => {
    const order = baseOrder({
      orderNumber: 'ORD-EXISTING',
      status: 'PAID',
      subtotal: 4999,
      currency: 'ZAR',
    })
    const decision = computeOrderBackfillPatch(order, true, new Map())
    expect(decision.action).toBe('migrate')
    // force re-evaluates currency, but resolveCurrency still prefers the
    // order's own existing (valid) currency value over the USD fallback —
    // force is about re-running the decision, not discarding good data.
    expect(decision.patch?.currency).toBe('ZAR')
    expect(decision.patch?.orderNumber).toMatch(/^ORD-/)
  })

  it('is idempotent: running twice on an order that was just migrated produces "skip" the second time', () => {
    const order = baseOrder()
    const first = computeOrderBackfillPatch(order, false, new Map([['507f1f77bcf86cd799439099', 'Widget']]))
    expect(first.action).toBe('migrate')

    const patched: LegacyOrderInput = {
      ...order,
      orderNumber: first.patch!.orderNumber!,
      status: first.patch!.status!,
      currency: first.patch!.currency!,
      subtotal: first.patch!.subtotal!,
      items: applyItemPatches(order.items!, first.patch!.items),
    }

    const second = computeOrderBackfillPatch(patched, false, new Map([['507f1f77bcf86cd799439099', 'Widget']]))
    expect(second.action).toBe('skip')
  })
})

describe('applyItemPatches', () => {
  it('only changes the title/currency of patched indices, leaving price/quantity untouched', () => {
    const items = [
      { product: 'a', title: null, price: 100, currency: null, quantity: 2 },
      { product: 'b', title: 'Already set', price: 200, currency: 'USD', quantity: 1 },
    ]
    const result = applyItemPatches(items, [{ index: 0, title: 'A', currency: 'USD' }])

    expect(result[0]).toEqual({ product: 'a', title: 'A', price: 100, currency: 'USD', quantity: 2 })
    expect(result[1]).toEqual(items[1]) // untouched
  })

  it('does not mutate the input array', () => {
    const items = [{ product: 'a', title: null, price: 100, currency: null, quantity: 2 }]
    const copy = JSON.parse(JSON.stringify(items))
    applyItemPatches(items, [{ index: 0, title: 'A', currency: 'USD' }])
    expect(items).toEqual(copy)
  })
})
