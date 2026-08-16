// tests/stateMachine.test.ts
import { describe, expect, it } from 'vitest'
import {
  assertValidOrderTransition,
  assertValidPaymentTransition,
  InvalidOrderTransitionError,
  InvalidPaymentTransitionError,
  isValidOrderTransition,
  isValidPaymentTransition,
} from '../src/lib/services/orderStateMachine'

describe('order status transitions', () => {
  it('allows the standard happy path', () => {
    expect(() => {
      assertValidOrderTransition('PENDING_PAYMENT', 'PAID')
      assertValidOrderTransition('PAID', 'PROCESSING')
      assertValidOrderTransition('PROCESSING', 'FULFILLED')
    }).not.toThrow()
  })

  it('allows the standard failure paths', () => {
    expect(isValidOrderTransition('PENDING_PAYMENT', 'PAYMENT_FAILED')).toBe(true)
    expect(isValidOrderTransition('PENDING_PAYMENT', 'PAYMENT_CANCELLED')).toBe(true)
    expect(isValidOrderTransition('PAID', 'REFUNDED')).toBe(true)
  })

  it('rejects skipping straight from PENDING_PAYMENT to FULFILLED', () => {
    expect(() => assertValidOrderTransition('PENDING_PAYMENT', 'FULFILLED')).toThrow(
      InvalidOrderTransitionError,
    )
  })

  it('rejects any transition out of a terminal state', () => {
    expect(isValidOrderTransition('CANCELLED', 'PENDING_PAYMENT')).toBe(false)
    expect(isValidOrderTransition('REFUNDED', 'PAID')).toBe(false)
  })

  it('treats a same-state "transition" as a no-op, not an error', () => {
    expect(isValidOrderTransition('PAID', 'PAID')).toBe(true)
  })
})

describe('payment status transitions', () => {
  it('allows PENDING -> PAID and PENDING -> FAILED', () => {
    expect(isValidPaymentTransition('PENDING', 'PAID')).toBe(true)
    expect(isValidPaymentTransition('PENDING', 'FAILED')).toBe(true)
  })

  it('rejects PAID -> FAILED (cannot un-succeed a payment)', () => {
    expect(() => assertValidPaymentTransition('PAID', 'FAILED')).toThrow(
      InvalidPaymentTransitionError,
    )
  })

  it('allows a fresh attempt after FAILED or CANCELLED', () => {
    expect(isValidPaymentTransition('FAILED', 'PENDING')).toBe(true)
    expect(isValidPaymentTransition('CANCELLED', 'PENDING')).toBe(true)
  })

  it('allows PAID -> REFUNDED', () => {
    expect(isValidPaymentTransition('PAID', 'REFUNDED')).toBe(true)
  })
})
