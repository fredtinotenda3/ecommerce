// tests/migrations/paymentBackfill.test.ts
import { describe, expect, it } from 'vitest'
import {
  computeHistoricalPaymentDecision,
  deriveFallbackMerchantReference,
  type LegacyOrderForPaymentBackfill,
} from '../../scripts/migrations/lib/paymentBackfill'

const baseOrder = (
  overrides: Partial<LegacyOrderForPaymentBackfill> = {},
): LegacyOrderForPaymentBackfill => ({
  id: '507f1f77bcf86cd799439011',
  createdAt: new Date('2023-05-14T10:00:00.000Z'),
  total: 4999,
  currency: 'USD',
  orderNumber: 'ORD-230514-99439011',
  stripePaymentIntentID: 'pi_123456',
  ...overrides,
})

describe('deriveFallbackMerchantReference', () => {
  it('is deterministic for the same order id', () => {
    const a = deriveFallbackMerchantReference('507f1f77bcf86cd799439011')
    const b = deriveFallbackMerchantReference('507f1f77bcf86cd799439011')
    expect(a).toBe(b)
  })

  it('differs for different order ids', () => {
    expect(deriveFallbackMerchantReference('a')).not.toBe(deriveFallbackMerchantReference('b'))
  })
})

describe('computeHistoricalPaymentDecision', () => {
  it('creates a PAID payment for a historical Stripe order with no existing payment', () => {
    const decision = computeHistoricalPaymentDecision(baseOrder(), false)

    expect(decision.action).toBe('create')
    expect(decision.payment).toEqual({
      orderId: '507f1f77bcf86cd799439011',
      provider: 'stripe',
      providerReference: 'pi_123456',
      merchantReference: 'ORD-230514-99439011',
      amount: 4999, // copied as-is from order.total, never recalculated
      currency: 'USD',
      status: 'PAID',
      paidAt: new Date('2023-05-14T10:00:00.000Z'),
    })
  })

  it('uses the deterministic fallback merchant reference when the order has no orderNumber yet', () => {
    const decision = computeHistoricalPaymentDecision(baseOrder({ orderNumber: null }), false)
    expect(decision.payment?.merchantReference).toBe(
      deriveFallbackMerchantReference('507f1f77bcf86cd799439011'),
    )
  })

  it('falls back to USD when the order has no currency', () => {
    const decision = computeHistoricalPaymentDecision(baseOrder({ currency: null }), false)
    expect(decision.payment?.currency).toBe('USD')
  })

  it('skips orders with no stripePaymentIntentID (not a historical Stripe order)', () => {
    const decision = computeHistoricalPaymentDecision(
      baseOrder({ stripePaymentIntentID: null }),
      false,
    )
    expect(decision.action).toBe('skip')
    expect(decision.reason).toMatch(/no stripePaymentIntentID/)
  })

  it('skips (does not create a duplicate) when a Payment already exists for the order', () => {
    const decision = computeHistoricalPaymentDecision(baseOrder(), true)
    expect(decision.action).toBe('skip')
    expect(decision.reason).toMatch(/already exists/)
  })

  it('is idempotent: the same order always produces the same payment shape', () => {
    const first = computeHistoricalPaymentDecision(baseOrder(), false)
    const second = computeHistoricalPaymentDecision(baseOrder(), false)
    expect(first).toEqual(second)
  })

  it('never derives amount from anything other than order.total', () => {
    const decision = computeHistoricalPaymentDecision(baseOrder({ total: 12345 }), false)
    expect(decision.payment?.amount).toBe(12345)
  })

  it('defaults amount to 0 rather than throwing when total is missing', () => {
    const decision = computeHistoricalPaymentDecision(baseOrder({ total: null }), false)
    expect(decision.payment?.amount).toBe(0)
  })
})
