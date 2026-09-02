// src/lib/services/PaymentService.ts
import type { Order, Payment } from '../domain/types'
import type { PaymentProvider } from '../payments/PaymentProvider'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import { assertValidPaymentTransition } from './orderStateMachine'
import { generateMerchantReference } from './pricing'

export class PaymentInitiationError extends Error {
  readonly raw?: unknown

  constructor(message: string, raw?: unknown) {
    super(message)
    this.raw = raw
    this.name = 'PaymentInitiationError'
  }
}

export class UnsupportedCurrencyError extends Error {
  constructor(provider: string, currency: string) {
    super(`Payment provider "${provider}" does not support currency "${currency}"`)
    this.name = 'UnsupportedCurrencyError'
  }
}

export class PaymentNotFoundError extends Error {
  constructor(reference: string) {
    super(`Payment not found for merchant reference: ${reference}`)
    this.name = 'PaymentNotFoundError'
  }
}

export interface InitiatePaymentOptions {
  customerEmail?: string
  customerPhone?: string
  returnUrl?: string
  resultUrl?: string
}

export interface RecordProviderInitiatedPaymentInput {
  /** The provider's own identifier for a payment that was ALREADY
   * created with the provider before this call (e.g. a Stripe
   * PaymentIntent id) — see `recordProviderInitiatedPayment`'s doc
   * comment for why this differs from `initiatePaymentForOrder`. */
  providerReference: string
  metadata?: Record<string, unknown>
}

export class PaymentService {
  private readonly paymentRepository: PaymentRepository
  private readonly provider: PaymentProvider

  constructor(paymentRepository: PaymentRepository, provider: PaymentProvider) {
    this.paymentRepository = paymentRepository
    this.provider = provider
  }

  /** Idempotent: calling this twice for the same order (same order
   * number => same merchant reference) returns the existing Payment
   * record on the second call rather than creating a duplicate or
   * calling the provider a second time. This is the mechanism that
   * satisfies the brief's "merchant references must support uniqueness"
   * requirement at the service level, backed by the unique DB index on
   * Payment.merchantReference (see db/models/Payment.ts). */
  async initiatePaymentForOrder(
    order: Order,
    options: InitiatePaymentOptions = {},
  ): Promise<Payment> {
    if (!this.provider.supports(order.currency)) {
      throw new UnsupportedCurrencyError(this.provider.name, order.currency)
    }

    const merchantReference = generateMerchantReference(order.orderNumber)

    const existing = await this.paymentRepository.getByMerchantReference(merchantReference)
    if (existing) {
      return existing
    }

    let payment: Payment
    try {
      payment = await this.paymentRepository.create({
        orderId: order.id,
        provider: this.provider.name,
        merchantReference,
        amount: order.total,
        currency: order.currency,
      })
    } catch (err: unknown) {
      // Duplicate-key race: another concurrent request created the
      // Payment between our check and our create. Treat it as success,
      // not a failure — this IS the idempotency guarantee working.
      const racedExisting = await this.paymentRepository.getByMerchantReference(merchantReference)
      if (racedExisting) {
        return racedExisting
      }
      throw err
    }

    const result = await this.provider.createPayment({
      merchantReference,
      orderId: order.id,
      amount: order.total,
      currency: order.currency,
      customerEmail: options.customerEmail,
      customerPhone: options.customerPhone,
      returnUrl: options.returnUrl,
      resultUrl: options.resultUrl,
    })

    if (!result.success) {
      await this.paymentRepository.updateStatus(payment.id, 'FAILED', {
        metadata: { errorMessage: result.errorMessage, raw: result.raw },
      })
      throw new PaymentInitiationError(
        result.errorMessage ?? 'Payment initiation failed',
        result.raw,
      )
    }

    const updated = await this.paymentRepository.updateStatus(payment.id, 'PENDING', {
      providerReference: result.providerReference,
      metadata: {
        redirectUrl: result.redirectUrl,
        pollUrl: result.pollUrl,
        instructions: result.instructions,
      },
    })

    return updated ?? payment
  }

  /** PHASE 13F-A — records a Payment for an order whose payment was
   * ALREADY initiated with the provider BEFORE the Order existed. This
   * is the native Stripe checkout's shape: the PaymentIntent is created
   * from the cart (StripeCheckoutService, via the customer's browser)
   * up front, and the Order is only created afterwards, once the
   * customer has confirmed payment client-side — the reverse order of
   * the Paynow flow, where `initiatePaymentForOrder` creates the Order
   * FIRST and then asks the provider to initiate payment for it.
   *
   * Unlike `initiatePaymentForOrder`, this NEVER calls
   * `this.provider.createPayment()` — doing so here would create a
   * SECOND, unused payment with the provider for the same order. It
   * only writes the Payment record that ties this Order to the
   * `providerReference` the caller already obtained, so the provider's
   * own webhook/callback (see StripeWebhookService) has something to
   * reconcile against.
   *
   * Same idempotency contract as `initiatePaymentForOrder`: calling this
   * twice for the same order (same order number => same merchant
   * reference) returns the existing Payment on the second call rather
   * than creating a duplicate, including the same duplicate-key race
   * handling. */
  async recordProviderInitiatedPayment(
    order: Order,
    input: RecordProviderInitiatedPaymentInput,
  ): Promise<Payment> {
    if (!this.provider.supports(order.currency)) {
      throw new UnsupportedCurrencyError(this.provider.name, order.currency)
    }

    const merchantReference = generateMerchantReference(order.orderNumber)

    const existing = await this.paymentRepository.getByMerchantReference(merchantReference)
    if (existing) {
      return existing
    }

    let payment: Payment
    try {
      payment = await this.paymentRepository.create({
        orderId: order.id,
        provider: this.provider.name,
        merchantReference,
        amount: order.total,
        currency: order.currency,
      })
    } catch (err: unknown) {
      // Duplicate-key race: another concurrent request created the
      // Payment between our check and our create — same idempotency
      // guarantee as initiatePaymentForOrder, see its comment above.
      const racedExisting = await this.paymentRepository.getByMerchantReference(merchantReference)
      if (racedExisting) {
        return racedExisting
      }
      throw err
    }

    const updated = await this.paymentRepository.updateStatus(payment.id, 'PENDING', {
      providerReference: input.providerReference,
      metadata: input.metadata ?? {},
    })

    return updated ?? payment
  }

  /** Processes a validated provider callback. Relies on
   * `provider.handleCallback` to have already thrown on an invalid
   * signature — this method never trusts a raw payload's status
   * directly. Re-delivery of the same callback (Paynow may retry) is
   * idempotent: if the payment is already in the reported status, this
   * is a no-op rather than a re-processing/duplicate side effect. */
  async handleProviderCallback(rawPayload: unknown): Promise<Payment> {
    const result = await this.provider.handleCallback(rawPayload)

    const payment = await this.paymentRepository.getByMerchantReference(result.merchantReference)
    if (!payment) {
      throw new PaymentNotFoundError(result.merchantReference)
    }

    if (payment.status === result.status) {
      // Duplicate/redelivered callback reporting a status we've already
      // recorded — idempotent no-op, per the brief's §19 requirement.
      return payment
    }

    assertValidPaymentTransition(payment.status, result.status)

    const updated = await this.paymentRepository.updateStatus(payment.id, result.status, {
      providerReference: result.providerReference ?? payment.providerReference ?? undefined,
      metadata: { ...payment.metadata, lastCallbackRaw: result.raw },
    })

    return updated ?? payment
  }
}
