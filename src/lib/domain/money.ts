// src/lib/domain/money.ts
//
// All monetary values in the native architecture are integers in minor
// units (e.g. cents). Never represent money as a float — floating point
// arithmetic on decimal currency amounts silently loses/gains cents.
//
// This module is the ONLY place minor-unit conversion math should happen.

import type { CurrencyCode, MinorUnits, Money } from './types'

/** Number of minor units per major unit, by currency. Extend as needed.
 * Defaults to 2 (cents) for any currency not listed, which covers USD,
 * ZWL/ZWG, and every other currency currently relevant to this project. */
const MINOR_UNIT_EXPONENT: Record<string, number> = {
  USD: 2,
  ZWL: 2,
  ZWG: 2,
  ZAR: 2,
  EUR: 2,
  GBP: 2,
}

export const getMinorUnitExponent = (currency: CurrencyCode): number =>
  MINOR_UNIT_EXPONENT[currency.toUpperCase()] ?? 2

/** Converts a decimal major-unit amount (e.g. 12.5 dollars) to an integer
 * minor-unit amount (e.g. 1250 cents). Throws on non-finite input rather
 * than silently coercing, since a bad conversion here is a pricing bug. */
export const toMinorUnits = (majorAmount: number, currency: CurrencyCode): MinorUnits => {
  if (!Number.isFinite(majorAmount)) {
    throw new Error(`toMinorUnits: majorAmount is not a finite number: ${majorAmount}`)
  }
  const exponent = getMinorUnitExponent(currency)
  const factor = 10 ** exponent
  // Round at the minor-unit boundary to avoid floating point artifacts
  // (e.g. 12.50 * 100 can come out as 1249.9999999998 in JS floats).
  return Math.round(majorAmount * factor)
}

/** Converts an integer minor-unit amount back to a decimal major-unit
 * number, for display purposes only. Never use the output of this
 * function as an input to further monetary arithmetic. */
export const toMajorUnits = (minorAmount: MinorUnits, currency: CurrencyCode): number => {
  const exponent = getMinorUnitExponent(currency)
  const factor = 10 ** exponent
  return minorAmount / factor
}

export const formatMoney = (money: Money, locale = 'en-US'): string => {
  return toMajorUnits(money.amount, money.currency).toLocaleString(locale, {
    style: 'currency',
    currency: money.currency,
  })
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Currency mismatch: cannot combine amounts in ${a} and ${b}`)
    this.name = 'CurrencyMismatchError'
  }
}

const assertSameCurrency = (a: CurrencyCode, b: CurrencyCode): void => {
  if (a.toUpperCase() !== b.toUpperCase()) {
    throw new CurrencyMismatchError(a, b)
  }
}

export const addMoney = (a: Money, b: Money): Money => {
  assertSameCurrency(a.currency, b.currency)
  return { amount: a.amount + b.amount, currency: a.currency }
}

export const multiplyMoney = (money: Money, quantity: number): Money => {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`multiplyMoney: quantity must be a non-negative integer, got ${quantity}`)
  }
  return { amount: money.amount * quantity, currency: money.currency }
}

export const zeroMoney = (currency: CurrencyCode): Money => ({ amount: 0, currency })

export const sumMoney = (amounts: Money[], currency: CurrencyCode): Money =>
  amounts.reduce((acc, m) => addMoney(acc, m), zeroMoney(currency))