// src/lib/services/PaymentService.ts
import type { Order, Payment } from '../domain/types'
import type { PaymentProvider } from '../payments/PaymentProvider'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import { assertValidPaymentTransition } from './orderStateMachine'
import { generateMerchantReference } from './pricing'

export class PaymentInitiationError extends Error {
  constructor(message: string, readonly raw?: unknown) {
    super(message)
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

export class PaymentService {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly provider: PaymentProvider,
  ) {}

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
    } catch (err) {
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
