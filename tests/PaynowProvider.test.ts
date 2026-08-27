// tests/PaynowProvider.test.ts
//
// All tests run against a FakePaynowHttpClient — no real network access
// or Paynow credentials are used or required, per the Phase 7 brief.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  InvalidPaynowCallbackError,
  PaynowProvider,
} from '../src/lib/payments/PaynowProvider'
import type { PaymentProvider } from '../src/lib/payments/PaymentProvider'
import type { PaynowConfig } from '../src/lib/payments/paynow/paynowConfig'
import { computeSignature } from '../src/lib/payments/paynow/paynowSignature'
import { UnrecognizedPaynowStatusError } from '../src/lib/payments/paynow/paynowStatusMap'
import { FakePaynowHttpClient } from './fakes/FakePaynowHttpClient'

const TEST_CONFIG: PaynowConfig = {
  integrationId: 'INTEGRATION_ID',
  integrationKey: 'INTEGRATION_KEY',
  resultUrl: 'https://shop.example.com/paynow/result',
  returnUrl: 'https://shop.example.com/paynow/return',
  mode: 'test',
}

/** Builds a valid, correctly-hashed initiate-transaction success
 * response body, exactly as Paynow's docs describe:
 * Status=Ok&BrowserUrl=...&PollUrl=...&Hash=... */
function buildInitiateSuccessResponse(overrides: { browserUrl?: string; pollUrl?: string } = {}) {
  const browserUrl = overrides.browserUrl ?? 'https://www.paynow.co.zw/Payment/ConfirmPayment/1169'
  const pollUrl =
    overrides.pollUrl ?? 'https://www.paynow.co.zw/Interface/CheckPayment/?guid=3cb27f4b-b3ef'
  const hash = computeSignature(['Ok', browserUrl, pollUrl], TEST_CONFIG.integrationKey)
  return `Status=Ok&BrowserUrl=${encodeURIComponent(browserUrl)}&PollUrl=${encodeURIComponent(pollUrl)}&Hash=${hash}`
}

/** Builds a valid, correctly-hashed status message, in the shape used
 * both by poll responses and resulturl callbacks:
 * reference=...&paynowreference=...&amount=...&status=...&hash=... */
function buildStatusMessage(fields: {
  reference: string
  paynowreference: string
  amount: string
  status: string
}) {
  const values = [fields.reference, fields.paynowreference, fields.amount, fields.status]
  const hash = computeSignature(values, TEST_CONFIG.integrationKey)
  return (
    `reference=${encodeURIComponent(fields.reference)}` +
    `&paynowreference=${encodeURIComponent(fields.paynowreference)}` +
    `&amount=${encodeURIComponent(fields.amount)}` +
    `&status=${encodeURIComponent(fields.status)}` +
    `&hash=${hash}`
  )
}

describe('PaynowProvider', () => {
  let httpClient: FakePaynowHttpClient
  let provider: PaynowProvider

  beforeEach(() => {
    httpClient = new FakePaynowHttpClient()
    provider = new PaynowProvider({ config: TEST_CONFIG, httpClient })
  })

  describe('supports (currency support checks)', () => {
    it('supports USD by default', () => {
      expect(provider.supports('USD')).toBe(true)
      expect(provider.supports('usd')).toBe(true)
    })

    it('does not support an unconfigured currency by default', () => {
      expect(provider.supports('ZWL')).toBe(false)
    })

    it('respects a custom supportedCurrencies list', () => {
      const zwlProvider = new PaynowProvider({
        config: TEST_CONFIG,
        httpClient,
        supportedCurrencies: ['ZWL'],
      })
      expect(zwlProvider.supports('ZWL')).toBe(true)
      expect(zwlProvider.supports('USD')).toBe(false)
    })

    it('exposes supportsRefunds as false (Paynow has no public refund API)', () => {
      expect(provider.supportsRefunds).toBe(false)
      const asInterface: PaymentProvider = provider
      expect(asInterface.refund).toBeUndefined()
    })
  })

  describe('createPayment (success)', () => {
    it('initiates a transaction and returns the redirect/poll URLs', async () => {
      httpClient.nextPostFormResponse = buildInitiateSuccessResponse()

      const result = await provider.createPayment({
        merchantReference: 'ORD-1',
        orderId: 'order-1',
        amount: 1000,
        currency: 'USD',
      })

      expect(result.success).toBe(true)
      expect(result.redirectUrl).toBe('https://www.paynow.co.zw/Payment/ConfirmPayment/1169')
      expect(result.pollUrl).toBe('https://www.paynow.co.zw/Interface/CheckPayment/?guid=3cb27f4b-b3ef')
    })

    it('converts minor-unit amounts to Paynow decimal format at the adapter boundary', async () => {
      httpClient.nextPostFormResponse = buildInitiateSuccessResponse()

      await provider.createPayment({
        merchantReference: 'ORD-2',
        orderId: 'order-2',
        amount: 123456, // minor units (cents)
        currency: 'USD',
      })

      expect(httpClient.postFormCalls).toHaveLength(1)
      expect(httpClient.postFormCalls[0].fields.amount).toBe('1234.56')
    })

    it('sends a request signed with the integration id/key and the documented field order', async () => {
      httpClient.nextPostFormResponse = buildInitiateSuccessResponse()

      await provider.createPayment({
        merchantReference: 'ORD-3',
        orderId: 'order-3',
        amount: 500,
        currency: 'USD',
        description: 'Widget purchase',
      })

      const { fields } = httpClient.postFormCalls[0]
      const expectedHash = computeSignature(
        [
          TEST_CONFIG.integrationId,
          'ORD-3',
          '5.00',
          'Widget purchase',
          TEST_CONFIG.returnUrl as string,
          TEST_CONFIG.resultUrl as string,
          'Message',
        ],
        TEST_CONFIG.integrationKey,
      )

      expect(fields.id).toBe(TEST_CONFIG.integrationId)
      expect(fields.reference).toBe('ORD-3')
      expect(fields.hash).toBe(expectedHash)
    })

    it('includes customerEmail as authemail when provided', async () => {
      httpClient.nextPostFormResponse = buildInitiateSuccessResponse()

      await provider.createPayment({
        merchantReference: 'ORD-4',
        orderId: 'order-4',
        amount: 500,
        currency: 'USD',
        customerEmail: 'buyer@example.com',
      })

      expect(httpClient.postFormCalls[0].fields.authemail).toBe('buyer@example.com')
    })
  })

  describe('createPayment (failure paths)', () => {
    it('fails without calling Paynow for an unsupported currency', async () => {
      const result = await provider.createPayment({
        merchantReference: 'ORD-5',
        orderId: 'order-5',
        amount: 1000,
        currency: 'ZWL',
      })

      expect(result.success).toBe(false)
      expect(result.errorMessage).toMatch(/does not support currency/i)
      expect(httpClient.postFormCalls).toHaveLength(0)
    })

    it('returns success:false when Paynow responds with a non-Ok status', async () => {
      httpClient.nextPostFormResponse = 'Status=Error&Error=Invalid+Reference'

      const result = await provider.createPayment({
        merchantReference: 'ORD-6',
        orderId: 'order-6',
        amount: 1000,
        currency: 'USD',
      })

      expect(result.success).toBe(false)
      expect(result.errorMessage).toBe('Invalid Reference')
    })

    it('returns success:false when the initiate-transaction response has an invalid hash', async () => {
      httpClient.nextPostFormResponse =
        'Status=Ok&BrowserUrl=https://example.com/pay&PollUrl=https://example.com/poll&Hash=TAMPERED'

      const result = await provider.createPayment({
        merchantReference: 'ORD-7',
        orderId: 'order-7',
        amount: 1000,
        currency: 'USD',
      })

      expect(result.success).toBe(false)
      expect(result.errorMessage).toMatch(/hash verification/i)
    })

    it('returns success:false (rather than throwing) when the transport fails', async () => {
      httpClient.nextPostFormResponse = new Error('network down')

      const result = await provider.createPayment({
        merchantReference: 'ORD-8',
        orderId: 'order-8',
        amount: 1000,
        currency: 'USD',
      })

      expect(result.success).toBe(false)
    })

    it('rejects non-integer or negative amounts before ever calling Paynow', async () => {
      const result = await provider.createPayment({
        merchantReference: 'ORD-9',
        orderId: 'order-9',
        amount: -100,
        currency: 'USD',
      })

      expect(result.success).toBe(false)
      expect(httpClient.postFormCalls).toHaveLength(0)
    })
  })

  describe('getPaymentStatus', () => {
    it('polls the given URL and maps a Paid status', async () => {
      httpClient.nextGetRawResponse = buildStatusMessage({
        reference: 'ORD-10',
        paynowreference: '999',
        amount: '25.00',
        status: 'Paid',
      })

      const result = await provider.getPaymentStatus('https://www.paynow.co.zw/poll/abc')

      expect(httpClient.getRawCalls).toEqual(['https://www.paynow.co.zw/poll/abc'])
      expect(result.status).toBe('PAID')
      expect(result.providerReference).toBe('999')
      expect(result.paidAmount).toBe(2500)
    })

    it('maps a Cancelled status', async () => {
      httpClient.nextGetRawResponse = buildStatusMessage({
        reference: 'ORD-11',
        paynowreference: '1000',
        amount: '10.00',
        status: 'Cancelled',
      })

      const result = await provider.getPaymentStatus('https://www.paynow.co.zw/poll/abc')
      expect(result.status).toBe('CANCELLED')
    })

    it('throws on an invalid hash rather than returning a status', async () => {
      httpClient.nextGetRawResponse = 'reference=ORD-12&amount=10.00&status=Paid&hash=TAMPERED'

      await expect(provider.getPaymentStatus('https://www.paynow.co.zw/poll/abc')).rejects.toThrow(
        InvalidPaynowCallbackError,
      )
    })

    it('throws UnrecognizedPaynowStatusError for an unmapped status rather than guessing', async () => {
      httpClient.nextGetRawResponse = buildStatusMessage({
        reference: 'ORD-13',
        paynowreference: '1001',
        amount: '10.00',
        status: 'SomeBrandNewStatus',
      })

      await expect(provider.getPaymentStatus('https://www.paynow.co.zw/poll/abc')).rejects.toThrow(
        UnrecognizedPaynowStatusError,
      )
    })
  })

  describe('handleCallback (valid callback mapping)', () => {
    it('maps a valid Paid callback to a CallbackHandlingResult', async () => {
      const rawPayload = buildStatusMessage({
        reference: 'ORD-14',
        paynowreference: '2000',
        amount: '15.50',
        status: 'Paid',
      })

      const result = await provider.handleCallback(rawPayload)

      expect(result).toEqual({
        merchantReference: 'ORD-14',
        status: 'PAID',
        providerReference: '2000',
        paidAmount: 1550,
        raw: {
          reference: 'ORD-14',
          paynowreference: '2000',
          amount: '15.50',
          status: 'Paid',
          hash: expect.any(String),
        },
      })
    })

    it('accepts a URLSearchParams payload equivalently to a raw string', async () => {
      const rawPayload = buildStatusMessage({
        reference: 'ORD-15',
        paynowreference: '2001',
        amount: '5.00',
        status: 'Awaiting Delivery',
      })
      const asParams = new URLSearchParams(rawPayload)

      const result = await provider.handleCallback(asParams)

      expect(result.merchantReference).toBe('ORD-15')
      expect(result.status).toBe('PAID')
    })

    it('is idempotent: repeated calls with the same payload return the same result', async () => {
      const rawPayload = buildStatusMessage({
        reference: 'ORD-16',
        paynowreference: '2002',
        amount: '5.00',
        status: 'Paid',
      })

      const first = await provider.handleCallback(rawPayload)
      const second = await provider.handleCallback(rawPayload)

      expect(second).toEqual(first)
    })
  })

  describe('handleCallback (invalid hash rejection)', () => {
    it('throws InvalidPaynowCallbackError on a tampered hash', async () => {
      const rawPayload = 'reference=ORD-17&paynowreference=2003&amount=5.00&status=Paid&hash=TAMPERED0000'

      await expect(provider.handleCallback(rawPayload)).rejects.toThrow(InvalidPaynowCallbackError)
    })

    it('throws InvalidPaynowCallbackError when the hash field is missing entirely', async () => {
      const rawPayload = 'reference=ORD-18&paynowreference=2004&amount=5.00&status=Paid'

      await expect(provider.handleCallback(rawPayload)).rejects.toThrow(InvalidPaynowCallbackError)
    })

    it('throws InvalidPaynowCallbackError when a field is altered after signing', async () => {
      const original = buildStatusMessage({
        reference: 'ORD-19',
        paynowreference: '2005',
        amount: '5.00',
        status: 'Paid',
      })
      // Flip the amount without recomputing the hash — simulates
      // in-transit tampering.
      const tampered = original.replace('amount=5.00', 'amount=500.00')

      await expect(provider.handleCallback(tampered)).rejects.toThrow(InvalidPaynowCallbackError)
    })

    it('throws InvalidPaynowCallbackError when required fields are missing, even with a syntactically well-formed hash', async () => {
      const hash = computeSignature(['Paid'], TEST_CONFIG.integrationKey)
      const rawPayload = `status=Paid&hash=${hash}` // no reference field

      await expect(provider.handleCallback(rawPayload)).rejects.toThrow(InvalidPaynowCallbackError)
    })

    it('rejects an unsupported payload shape', async () => {
      await expect(provider.handleCallback(12345 as unknown)).rejects.toThrow(
        InvalidPaynowCallbackError,
      )
    })
  })
})
