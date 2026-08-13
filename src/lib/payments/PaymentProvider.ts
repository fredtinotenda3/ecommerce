// src/lib/payments/PaymentProvider.ts
//
// Provider-neutral payment abstraction.
//
// RULES FOR THIS FILE:
//   - MUST NOT import `stripe`, `@stripe/*`, or any future Paynow SDK.
//   - MUST NOT import Payload.
//   - This is purely the seam. Concrete providers (StripePaymentProvider,
//     PaynowPaymentProvider) implement this interface elsewhere and are
//     wired in at the application composition point, never referenced by
//     name from PaymentService or above.
//
// Phase 1 note: no concrete provider is implemented yet. Paynow
// integration is a later, explicitly-approved phase. Stripe's EXISTING
// checkout flow continues to run entirely outside this abstraction for
// now — it is not migrated onto PaymentProvider in this phase.

import type { CurrencyCode, MinorUnits, PaymentProviderName } from '../domain/types'

export interface InitiatePaymentInput {
  /** The value we generated (Order.orderNumber-derived, unique per
   * attempt). This is what the provider should echo back on callback so
   * we can match it — never trust a bare orderId from an inbound
   * callback without validating it against this reference. */
  merchantReference: string
  amount: MinorUnits
  currency: CurrencyCode
  /** Where the provider should send the shopper back to after leaving its
   * hosted payment page. A redirect arriving at this URL is NEVER, by
   * itself, proof of payment — see PaymentCallbackResult. */
  returnUrl: string
  /** Where the provider should POST/GET its asynchronous server-to-server
   * payment notification. */
  resultUrl: string
  description?: string
  customerEmail?: string | null
}

export interface InitiatePaymentResult {
  /** The provider's own identifier for this payment/transaction, if the
   * provider assigns one synchronously at initiation. May be null for
   * providers that only assign a reference once the shopper completes
   * the hosted flow. */
  providerReference: string | null
  /** URL to redirect the shopper to in order to complete payment
   * (hosted checkout page, USSD prompt confirmation page, etc). */
  redirectUrl: string
  /** Raw provider response, stored on the PaymentAttempt for audit /
   * support purposes. Never used directly for business decisions. */
  rawResponse: Record<string, unknown>
}

/**
 * The result of validating an inbound payment notification (webhook,
 * callback, or a status poll). This is the ONLY thing PaymentService is
 * allowed to treat as evidence of a status change — a shopper-facing
 * redirect back to `returnUrl` must never be treated as proof of
 * payment on its own, since the shopper controls that navigation.
 */
export interface PaymentCallbackResult {
  merchantReference: string
  providerReference: string | null
  status: 'PAID' | 'FAILED' | 'CANCELLED' | 'PENDING'
  amount: MinorUnits | null
  currency: CurrencyCode | null
  paymentMethod: string | null
  /** Whether the provider payload's authenticity was verified (signature,
   * hash, or a server-side poll back to the provider) — as opposed to
   * merely being well-formed. PaymentService MUST refuse to apply a
   * status transition when this is false. */
  verified: boolean
  rawPayload: Record<string, unknown>
}

export interface PaymentProvider {
  readonly name: PaymentProviderName

  /** Initiates a payment with the provider for an already-created,
   * server-priced Order. Callers must never pass a client-supplied
   * amount here — the amount must come from the Order/domain layer. */
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>

  /** Parses and verifies an inbound provider notification. Implementations
   * are responsible for signature/hash verification (or an authoritative
   * server-side poll) — this method must return `verified: false` rather
   * than throwing when verification fails, so the caller can log and
   * reject the callback without leaking whether a given reference exists. */
  parseCallback(rawPayload: Record<string, unknown>): Promise<PaymentCallbackResult>

  /** Authoritative status check, independent of any callback — used to
   * reconcile a payment when no callback has arrived (e.g. a scheduled
   * reconciliation job) or to double-check a callback before trusting it. */
  pollStatus(merchantReference: string): Promise<PaymentCallbackResult>
}