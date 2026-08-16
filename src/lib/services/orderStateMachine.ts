// src/lib/services/orderStateMachine.ts
//
// Pure validators for Order/Payment status transitions. No I/O. Services
// call these before ever writing a new status to the database — a
// repository's `updateStatus` method intentionally does NOT validate the
// transition itself (repositories stay dumb/infrastructure-only), so
// skipping this check would let an invalid transition reach the DB.

import type { OrderStatus, PaymentStatus } from '../domain/types'
import { ORDER_STATUS_TRANSITIONS, PAYMENT_STATUS_TRANSITIONS } from '../domain/types'

export class InvalidOrderTransitionError extends Error {
  constructor(readonly from: OrderStatus, readonly to: OrderStatus) {
    super(`Invalid order status transition: ${from} -> ${to}`)
    this.name = 'InvalidOrderTransitionError'
  }
}

export class InvalidPaymentTransitionError extends Error {
  constructor(readonly from: PaymentStatus, readonly to: PaymentStatus) {
    super(`Invalid payment status transition: ${from} -> ${to}`)
    this.name = 'InvalidPaymentTransitionError'
  }
}

export const isValidOrderTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  from === to || ORDER_STATUS_TRANSITIONS[from]?.includes(to) === true

export const assertValidOrderTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!isValidOrderTransition(from, to)) {
    throw new InvalidOrderTransitionError(from, to)
  }
}

export const isValidPaymentTransition = (from: PaymentStatus, to: PaymentStatus): boolean =>
  from === to || PAYMENT_STATUS_TRANSITIONS[from]?.includes(to) === true

export const assertValidPaymentTransition = (from: PaymentStatus, to: PaymentStatus): void => {
  if (!isValidPaymentTransition(from, to)) {
    throw new InvalidPaymentTransitionError(from, to)
  }
}
