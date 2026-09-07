// src/lib/services/PaynowCheckoutService.ts
//
// orchestrates Paynow checkout initiation: given an
// authenticated customer id and their SERVER-SIDE cart items, this is
// the only code path that turns a cart into an Order + Payment for the
// Paynow flow.
//
// SECURITY: this file adds no pricing logic of its own. Every price
// comes from `OrderService.createOrderFromCart`, which re-fetches every
// product fresh from the database and prices every line item from that
// (see pricing.ts) — it never trusts anything the caller supplies about
// price. Nothing in `InitiatePaynowCheckoutInput` carries a price or
// total; `cartItems` is `{ productId, quantity }[]` only, and the
// caller (see src/app/_api/paynowCheckout.ts) is responsible for having
// read that array from the database, never from client-supplied JSON.
//
// Deliberately takes `OrderService`/`PaymentService` as injected deps
// (both already accept repository INTERFACES themselves), so this is
// unit testable end-to-end with the existing Fake*Repository /
// FakePaymentProvider fakes, without a live database or a real Paynow
// account — see tests/paynowCheckoutService.test.ts.

import type { CartItem, Order, Payment } from '../domain/types'
import type { OrderService } from './OrderService'
import type { InitiatePaymentOptions, PaymentService } from './PaymentService'

export class CheckoutRedirectMissingError extends Error {
  readonly paymentId: string

  constructor(paymentId: string) {
    super(`Paynow did not return a redirect URL for payment ${paymentId}`)
    this.name = 'CheckoutRedirectMissingError'
    this.paymentId = paymentId
  }
}

export interface PaynowCheckoutDeps {
  orderService: OrderService
  paymentService: PaymentService
}

export interface InitiatePaynowCheckoutInput {
  customerId: string
  /** MUST be read by the caller from a server-side source (the
   * customer's persisted cart) — never accepted verbatim from a request
   * body. This orchestrator does not care where it came from, but see
   * the file header for why that matters. */
  cartItems: CartItem[]
  customerEmail?: string
  customerPhone?: string
  /** Where Paynow POSTs its authoritative status update. Fixed per
   * deployment (see PAYNOW_RESULT_URL) or derived from the incoming
   * request's origin by the caller. */
  resultUrl: string
  /** Paynow's browser return URL needs the Order's number/id to be
   * useful (so the customer lands on an order-status page), but the
   * Order does not exist yet when this function is called — so callers
   * pass a builder rather than a fixed string, invoked once the Order
   * has actually been created. */
  buildReturnUrl: (order: Order) => string
}

export interface PaynowCheckoutResult {
  order: Order
  payment: Payment
  redirectUrl: string
}

/** Creates the Order (server-priced from the DB, status
 * PENDING_PAYMENT) then initiates the Paynow payment for it. Any
 * pricing/availability problem in the cart (OrderService/pricing.ts's
 * `ProductNotPurchasableError`, `EmptyCartError`, `MixedCurrencyCartError`)
 * or provider problem (PaymentService's `UnsupportedCurrencyError`,
 * `PaymentInitiationError`) propagates to the caller rather than being
 * swallowed here — the route handler decides the HTTP status for each. */
export const initiatePaynowCheckout = async (
  input: InitiatePaynowCheckoutInput,
  deps: PaynowCheckoutDeps,
): Promise<PaynowCheckoutResult> => {
  // Throws EmptyCartError (from pricing.ts, via OrderService) if
  // cartItems is empty, and ProductNotPurchasableError /
  // MixedCurrencyCartError for anything in the cart that isn't
  // currently a valid, published, single-currency line item.
  const order = await deps.orderService.createOrderFromCart(input.customerId, input.cartItems)

  const options: InitiatePaymentOptions = {
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    returnUrl: input.buildReturnUrl(order),
    resultUrl: input.resultUrl,
  }

  // Throws UnsupportedCurrencyError / PaymentInitiationError on failure
  // (and, per PaymentService's own contract, marks the Payment FAILED
  // before throwing in the latter case — nothing further to do here).
  const payment = await deps.paymentService.initiatePaymentForOrder(order, options)

  const redirectUrl = payment.metadata?.redirectUrl
  if (typeof redirectUrl !== 'string' || redirectUrl.length === 0) {
    throw new CheckoutRedirectMissingError(payment.id)
  }

  return { order, payment, redirectUrl }
}
