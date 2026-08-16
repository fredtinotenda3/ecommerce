// src/lib/payments/PaymentProvider.ts
//
// Provider-neutral payment abstraction. This phase defines the interface
// ONLY — no PaynowProvider implementation is created here (that's Phase
// 7, per the migration brief), and this file must never import a Paynow
// or Stripe SDK.
//
// The interface is deliberately minimal and framed around what the
// application's checkout flow actually needs (see the audit's Target
// Payment Flow): initiate a payment, check its status, and process an
// asynchronous callback. Refunds are modeled but may not be supported by
// every provider (see `supportsRefunds`).

import type { CurrencyCode, MinorUnits, PaymentProviderName, PaymentStatus } from '../domain/types'

export interface CreatePaymentInput {
  /** Our own merchant-generated reference — MUST be used by the provider
   * adapter as the idempotency key handed to the provider, where the
   * provider's API supports one. */
  merchantReference: string
  orderId: string
  amount: MinorUnits
  currency: CurrencyCode
  customerEmail?: string
  customerPhone?: string
  description?: string
  returnUrl?: string
  resultUrl?: string
}

export interface CreatePaymentResult {
  success: boolean
  /** URL to redirect the customer to complete payment (web-based flows). */
  redirectUrl?: string
  /** URL the application can poll to check status (if the provider
   * supports polling in addition to/instead of callbacks). */
  pollUrl?: string
  /** Human-readable instructions for the customer, for flows that don't
   * redirect (e.g. mobile money push payments). */
  instructions?: string
  /** The provider's own identifier for this payment, if known at
   * initiation time (not all providers return one immediately). */
  providerReference?: string
  errorMessage?: string
  /** Raw provider response, retained for debugging/audit — never parsed
   * by calling code, only logged/stored. */
  raw?: unknown
}

export interface PaymentStatusResult {
  status: PaymentStatus
  providerReference?: string
  paidAmount?: MinorUnits
  currency?: CurrencyCode
  raw?: unknown
}

/** Result of validating and interpreting an inbound provider callback
 * (e.g. Paynow's resultUrl POST). Implementations MUST validate any
 * provider-supplied signature/hash before returning a result — a
 * callback that fails validation should throw, not return a status. */
export interface CallbackHandlingResult {
  merchantReference: string
  status: PaymentStatus
  providerReference?: string
  paidAmount?: MinorUnits
  currency?: CurrencyCode
  raw?: unknown
}

export interface RefundInput {
  paymentId: string
  providerReference: string
  amount: MinorUnits
  currency: CurrencyCode
  reason?: string
}

export interface RefundResult {
  success: boolean
  providerReference?: string
  errorMessage?: string
  raw?: unknown
}

export interface PaymentProvider {
  readonly name: PaymentProviderName

  /** Whether this provider can process a payment in the given currency.
   * Used by PaymentService to pick/validate a provider before attempting
   * initiation — must be checked before createPayment() is called. */
  supports(currency: CurrencyCode): boolean

  readonly supportsRefunds: boolean

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>

  getPaymentStatus(providerReferenceOrPollUrl: string): Promise<PaymentStatusResult>

  /** Validates and interprets a raw inbound callback payload. Must throw
   * on an invalid/unverifiable signature rather than returning a
   * "best guess" status — the caller (a route handler) is responsible for
   * catching that and responding appropriately, never for trusting an
   * unvalidated callback. */
  handleCallback(rawPayload: unknown): Promise<CallbackHandlingResult>

  refund?(input: RefundInput): Promise<RefundResult>
}

/** Thrown by a provider implementation when a capability is invoked that
 * it does not actually support (e.g. refund() on a provider with
 * `supportsRefunds: false`). Distinguishes "not implemented yet" bugs
 * from genuine provider-side failures. */
export class UnsupportedPaymentOperationError extends Error {
  constructor(provider: PaymentProviderName, operation: string) {
    super(`Payment provider "${provider}" does not support operation "${operation}"`)
    this.name = 'UnsupportedPaymentOperationError'
  }
}
