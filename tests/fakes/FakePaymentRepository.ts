// tests/fakes/FakePaymentRepository.ts
import type { CreatePaymentInput, PaymentRepository } from '../../src/lib/repositories/PaymentRepository'
import type { Payment, PaymentStatus } from '../../src/lib/domain/types'

let counter = 0

export class FakePaymentRepository implements PaymentRepository {
  private payments = new Map<string, Payment>()

  async getById(id: string): Promise<Payment | null> {
    return this.payments.get(id) ?? null
  }

  async getByOrderId(orderId: string): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(p => p.orderId === orderId)
  }

  async getByMerchantReference(merchantReference: string): Promise<Payment | null> {
    return Array.from(this.payments.values()).find(p => p.merchantReference === merchantReference) ?? null
  }

  /** Mirrors the real repository's unique-index behavior: creating a
   * second payment with a merchant reference that already exists throws,
   * so PaymentService's race-handling path is exercised the same way it
   * would be against real MongoDB. */
  async create(input: CreatePaymentInput): Promise<Payment> {
    const existing = await this.getByMerchantReference(input.merchantReference)
    if (existing) {
      throw new Error('E11000 duplicate key error: merchantReference must be unique')
    }

    const id = `payment_${++counter}`
    const payment: Payment = {
      id,
      orderId: input.orderId,
      provider: input.provider,
      providerReference: null,
      merchantReference: input.merchantReference,
      amount: input.amount,
      currency: input.currency,
      status: 'PENDING',
      paymentMethod: null,
      initiatedAt: new Date(),
      paidAt: null,
      failedAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.payments.set(id, payment)
    return payment
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra?: { providerReference?: string; paymentMethod?: string; metadata?: Record<string, unknown> },
  ): Promise<Payment | null> {
    const payment = this.payments.get(id)
    if (!payment) return null
    const updated: Payment = {
      ...payment,
      status,
      providerReference: extra?.providerReference ?? payment.providerReference,
      paymentMethod: extra?.paymentMethod ?? payment.paymentMethod,
      metadata: extra?.metadata ?? payment.metadata,
      paidAt: status === 'PAID' ? new Date() : payment.paidAt,
      failedAt: status === 'FAILED' ? new Date() : payment.failedAt,
      updatedAt: new Date(),
    }
    this.payments.set(id, updated)
    return updated
  }
}
