// tests/stripeWebhookService.test.ts
//
// PHASE 13E — tests the native Stripe webhook signature verification +
// event classification. Uses a fake `StripeWebhookVerifier` (no real
// Stripe network call, no real signed payload needed).

import { describe, expect, it } from 'vitest'

import {
  processStripeWebhookEvent,
  StripeWebhookConfigError,
  StripeWebhookSignatureError,
  type StripeEventLike,
  type StripeWebhookVerifier,
} from '../src/lib/services/StripeWebhookService'

const buildEvent = (overrides: Partial<StripeEventLike> = {}): StripeEventLike => ({
  id: 'evt_test_1',
  type: 'payment_intent.succeeded',
  data: { object: {} },
  ...overrides,
})

class FakeVerifier implements StripeWebhookVerifier {
  constructor(
    private readonly result: StripeEventLike | (() => StripeEventLike),
    private readonly shouldThrow = false,
  ) {}

  constructEvent(): StripeEventLike {
    if (this.shouldThrow) {
      throw new Error('No signatures found matching the expected signature for payload')
    }
    return typeof this.result === 'function' ? this.result() : this.result
  }
}

describe('processStripeWebhookEvent', () => {
  it('returns handled: true for a verified payment_intent.succeeded event', () => {
    const verifier = new FakeVerifier(buildEvent({ type: 'payment_intent.succeeded' }))

    const result = processStripeWebhookEvent('raw-body', 'sig_abc', {
      verifier,
      webhookSecret: 'whsec_test',
    })

    expect(result).toEqual({ eventId: 'evt_test_1', eventType: 'payment_intent.succeeded', handled: true })
  })

  it('returns handled: true for payment_intent.payment_failed and payment_intent.canceled', () => {
    const verifier1 = new FakeVerifier(buildEvent({ type: 'payment_intent.payment_failed' }))
    expect(
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier: verifier1, webhookSecret: 'whsec_test' })
        .handled,
    ).toBe(true)

    const verifier2 = new FakeVerifier(buildEvent({ type: 'payment_intent.canceled' }))
    expect(
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier: verifier2, webhookSecret: 'whsec_test' })
        .handled,
    ).toBe(true)
  })

  it('returns handled: false (not an error) for an event type this phase does not act on, e.g. product.updated', () => {
    const verifier = new FakeVerifier(buildEvent({ type: 'product.updated', id: 'evt_test_2' }))

    const result = processStripeWebhookEvent('raw-body', 'sig_abc', {
      verifier,
      webhookSecret: 'whsec_test',
    })

    expect(result).toEqual({ eventId: 'evt_test_2', eventType: 'product.updated', handled: false })
  })

  it('throws StripeWebhookConfigError when no webhook secret is configured', () => {
    const verifier = new FakeVerifier(buildEvent())

    expect(() =>
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier, webhookSecret: undefined }),
    ).toThrow(StripeWebhookConfigError)
  })

  it('throws StripeWebhookSignatureError when the Stripe-Signature header is missing', () => {
    const verifier = new FakeVerifier(buildEvent())

    expect(() =>
      processStripeWebhookEvent('raw-body', null, { verifier, webhookSecret: 'whsec_test' }),
    ).toThrow(StripeWebhookSignatureError)
  })

  it('throws StripeWebhookSignatureError when the verifier rejects the signature', () => {
    const verifier = new FakeVerifier(buildEvent(), true)

    expect(() =>
      processStripeWebhookEvent('raw-body', 'sig_bad', { verifier, webhookSecret: 'whsec_test' }),
    ).toThrow(StripeWebhookSignatureError)
  })

  it('never calls the verifier when the secret is missing (fails closed before touching the payload)', () => {
    let called = false
    const verifier: StripeWebhookVerifier = {
      constructEvent() {
        called = true
        return buildEvent()
      },
    }

    expect(() =>
      processStripeWebhookEvent('raw-body', 'sig_abc', { verifier, webhookSecret: undefined }),
    ).toThrow(StripeWebhookConfigError)
    expect(called).toBe(false)
  })
})
