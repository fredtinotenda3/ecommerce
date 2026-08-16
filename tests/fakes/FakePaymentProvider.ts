// tests/fakes/FakePaymentProvider.ts
import type {
  CallbackHandlingResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatusResult,
} from '../../src/lib/payments/PaymentProvider'
import type { PaymentStatus } from '../../src/lib/domain/types'

/** Always succeeds at initiation. Callback behavior is configurable per
 * test via `nextCallbackStatus`. Deliberately does NOT simulate real
 * Paynow behavior in any detail — it exists purely to exercise
 * PaymentService's orchestration logic (idempotency, state transitions),
 * not to stand in for Paynow's actual API contract. */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = 'paynow' as const
  readonly supportsRefunds = false

  public createPaymentCallCount = 0
  public nextCallbackStatus: PaymentStatus = 'PAID'
  public supportedCurrencies = new Set(['USD'])

  supports(currency: string): boolean {
    return this.supportedCurrencies.has(currency.toUpperCase())
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.createPaymentCallCount += 1
    return {
      success: true,
      redirectUrl: `https://fake-paynow.test/pay/${input.merchantReference}`,
      pollUrl: `https://fake-paynow.test/poll/${input.merchantReference}`,
      providerReference: `fake-ref-${input.merchantReference}`,
    }
  }

  async getPaymentStatus(): Promise<PaymentStatusResult> {
    return { status: this.nextCallbackStatus }
  }

  async handleCallback(rawPayload: unknown): Promise<CallbackHandlingResult> {
    const payload = rawPayload as { merchantReference: string; valid?: boolean }
    if (payload.valid === false) {
      throw new Error('Invalid callback signature')
    }
    return {
      merchantReference: payload.merchantReference,
      status: this.nextCallbackStatus,
      providerReference: `fake-ref-${payload.merchantReference}`,
    }
  }
}

/** Always fails at initiation — for testing PaymentService's failure
 * path (Payment gets marked FAILED, PaymentInitiationError is thrown). */
export class FailingFakePaymentProvider implements PaymentProvider {
  readonly name = 'paynow' as const
  readonly supportsRefunds = false

  supports(): boolean {
    return true
  }

  async createPayment(): Promise<CreatePaymentResult> {
    return { success: false, errorMessage: 'Simulated provider failure' }
  }

  async getPaymentStatus(): Promise<PaymentStatusResult> {
    return { status: 'FAILED' }
  }

  async handleCallback(): Promise<CallbackHandlingResult> {
    throw new Error('not used in failure-path tests')
  }
}
