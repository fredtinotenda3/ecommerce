// tests/money.test.ts
import { describe, expect, it } from 'vitest'
import {
  addMoney,
  CurrencyMismatchError,
  formatMoney,
  multiplyMoney,
  sumMoney,
  toMajorUnits,
  toMinorUnits,
} from '../src/lib/domain/money'

describe('money conversion', () => {
  it('converts major units to minor units without floating point drift', () => {
    expect(toMinorUnits(12.5, 'USD')).toBe(1250)
    expect(toMinorUnits(0.1, 'USD')).toBe(10)
    expect(toMinorUnits(19.99, 'USD')).toBe(1999)
  })

  it('converts minor units back to major units', () => {
    expect(toMajorUnits(1250, 'USD')).toBe(12.5)
    expect(toMajorUnits(1999, 'USD')).toBeCloseTo(19.99)
  })

  it('throws on non-finite input rather than silently coercing', () => {
    expect(() => toMinorUnits(NaN, 'USD')).toThrow()
    expect(() => toMinorUnits(Infinity, 'USD')).toThrow()
  })

  it('formats money for display', () => {
    expect(formatMoney({ amount: 1999, currency: 'USD' })).toBe('$19.99')
  })
})

describe('money arithmetic', () => {
  it('adds two amounts in the same currency', () => {
    const result = addMoney({ amount: 1000, currency: 'USD' }, { amount: 500, currency: 'USD' })
    expect(result).toEqual({ amount: 1500, currency: 'USD' })
  })

  it('refuses to add amounts in different currencies', () => {
    expect(() =>
      addMoney({ amount: 1000, currency: 'USD' }, { amount: 500, currency: 'ZWL' }),
    ).toThrow(CurrencyMismatchError)
  })

  it('multiplies an amount by an integer quantity', () => {
    expect(multiplyMoney({ amount: 1999, currency: 'USD' }, 3)).toEqual({
      amount: 5997,
      currency: 'USD',
    })
  })

  it('rejects a non-integer or negative quantity', () => {
    expect(() => multiplyMoney({ amount: 1000, currency: 'USD' }, 1.5)).toThrow()
    expect(() => multiplyMoney({ amount: 1000, currency: 'USD' }, -1)).toThrow()
  })

  it('sums a list of amounts', () => {
    const total = sumMoney(
      [
        { amount: 1000, currency: 'USD' },
        { amount: 2000, currency: 'USD' },
        { amount: 500, currency: 'USD' },
      ],
      'USD',
    )
    expect(total.amount).toBe(3500)
  })
})
