// src/lib/payments/StripeProvider.ts
//
// PHASE 13F-A — minimal `PaymentProvider` adapter for Stripe.
//
// This exists ONLY so `PaymentService` (which is constructed with a
// `PaymentRepository` + a `PaymentProvider`) can be used on the native
// Stripe order-creation path — see StripeOrderService.ts /
// PaymentService.recordProviderInitiatedPayment. That method reads only
// `provider.name` (to tag the created Payment as `provider: 'stripe'`)
// and `provider.supports(currency)` (a pre-flight guard, same as the
// Paynow path) — it never calls `createPayment`/`getPaymentStatus`/
// `handleCallback`.
//
// Those three ARE intentionally left unimplemented (they throw
// `UnsupportedPaymentOperationError`): in the native Stripe flow, the
// PaymentIntent is created by `StripeCheckoutService`'s own
// `StripePaymentIntentGateway` (see stripeCheckoutNative.ts) BEFORE the
// Order exists, and status/callback handling for Stripe goes through
// `StripeWebhookService`'s webhook reconciliation, not through
// `PaymentProvider.handleCallback`. Calling any of these three would be
// a bug in the calling code, not a legitimate use of this adapter — the
// thrown error is deliberately loud rather than silently returning a
// fake success.

import type { CurrencyCode, PaymentProviderName } from '../domain/types'
import type {
  CallbackHandlingResult,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatusResult,
} from './PaymentProvider'
import { UnsupportedPaymentOperationError } from './PaymentProvider'

export interface StripeProviderOptions {
  /** Defaults to accepting any well-formed 3-letter ISO 4217 code:
   * unlike Paynow (USD-only in this codebase), Stripe genuinely supports
   * 135+ settlement currencies, and this repository's `Product.currency`
   * is free-form per-product (see domain/types.ts) rather than pinned to
   * a single value. Pass an explicit allowlist in tests/deployments that
   * want to restrict this. */
  supportedCurrencies?: string[]
}

const ISO_4217_SHAPE = /^[A-Za-z]{3}$/

export class StripeProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'stripe'
  readonly supportsRefunds = false

  private readonly supportedCurrencies: Set<string> | null

  constructor(options: StripeProviderOptions = {}) {
    this.supportedCurrencies = options.supportedCurrencies
      ? new Set(options.supportedCurrencies.map(c => c.toUpperCase()))
      : null
  }

  supports(currency: CurrencyCode): boolean {
    if (this.supportedCurrencies) {
      return this.supportedCurrencies.has(currency.toUpperCase())
    }
    return ISO_4217_SHAPE.test(currency)
  }

  async createPayment(): Promise<CreatePaymentResult> {
    throw new UnsupportedPaymentOperationError('stripe', 'createPayment')
  }

  async getPaymentStatus(): Promise<PaymentStatusResult> {
    throw new UnsupportedPaymentOperationError('stripe', 'getPaymentStatus')
  }

  async handleCallback(): Promise<CallbackHandlingResult> {
    throw new UnsupportedPaymentOperationError('stripe', 'handleCallback')
  }
}
