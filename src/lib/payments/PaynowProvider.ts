// src/lib/payments/PaynowProvider.ts
//
// Concrete `PaymentProvider` implementation (see PaymentProvider.ts,
// Phase 1) for Paynow Zimbabwe (https://developers.paynow.co.zw).
//
// PHASE 7 SCOPE: this file implements the provider ADAPTER only. It is
// not wired into checkout, cart, or any storefront route — see the
// Phase 7 report for the full list of what was and wasn't touched.
//
// Implemented against Paynow's documented REST API directly (not the
// official `paynow` npm SDK) using only Node's built-in `fetch` and
// `crypto` — no new runtime dependency was added. See the Phase 7
// report for the reasoning: the SDK is a thin wrapper over the same
// endpoints, and calling the documented HTTP API directly keeps the
// hash/status logic fully unit-testable via an injected
// `PaynowHttpClient` without needing to mock a third-party class's
// internals.
//
// Endpoints used:
//   - POST https://www.paynow.co.zw/interface/initiatetransaction
//     (https://developers.paynow.co.zw/docs/paynow/initiate_transaction/)
//   - GET <pollUrl> (a URL Paynow itself returns from the above; see
//     https://developers.paynow.co.zw/docs/paynow/polling_status/)
//   - Inbound: Paynow POSTs a status update to the merchant's
//     `resulturl` (https://developers.paynow.co.zw/docs/paynow/status_update/)
//     — handled here by `handleCallback`, not by an outbound call.
//
// Hash generation/validation follows
// https://developers.paynow.co.zw/docs/paynow/generating_hash/ and
// https://developers.paynow.co.zw/docs/paynow/validating_hash/ exactly
// — `paynowSignature.ts`'s `computeSignature` is verified against both
// pages' worked examples in tests/paynowSignature.test.ts.
//
// Currency: Paynow's initiate-transaction request has no currency
// field — the transaction currency is a property of which merchant
// integration (ID/key pair) is used, configured on Paynow's side, not
// selected per-request. `supports()` is therefore a pre-flight
// application-level check only (mirrors how PaymentService already
// uses it — see initiatePaymentForOrder), not something enforced by an
// API parameter. ASSUMPTION: defaults to USD-only, since that's Paynow's
// primary supported currency for API integrations; override via
// `PaynowProviderOptions.supportedCurrencies` if a given integration is
// configured differently.
//
// Mobile money (Express Checkout / EcoCash / OneMoney): NOT implemented
// in this phase. `CreatePaymentInput` (frozen in Phase 1) has no field
// to select a mobile money method, so createPayment() always uses the
// standard web-redirect flow (`send`, not `sendMobile`, in the
// official SDK's terms). See the Phase 7 report's "Recommended Phase 8"
// section.
//
// Refunds: Paynow does not expose a public merchant-facing refund API
// (refunds are handled manually via Paynow support/dashboard, per their
// docs). `supportsRefunds` is `false` and `refund()` is not implemented,
// per the Phase 1 interface's own guidance for providers that don't
// support it.

import type { CurrencyCode, MinorUnits, PaymentProviderName } from '../domain/types'
import type {
  CallbackHandlingResult,
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatusResult,
} from './PaymentProvider'
import { loadPaynowConfig, type PaynowConfig, PaynowConfigError } from './paynow/paynowConfig'
import {
  FetchPaynowHttpClient,
  type PaynowHttpClient,
  PaynowTransportError,
} from './paynow/PaynowHttpClient'
import { computeSignature, parseFormEncoded, verifyInboundHash } from './paynow/paynowSignature'
import { mapPaynowStatus } from './paynow/paynowStatusMap'

const PAYNOW_INITIATE_TRANSACTION_URL = 'https://www.paynow.co.zw/interface/initiatetransaction'

/** The literal Paynow requires in the `status` field of an initiate-
 * transaction request — not related to the app's own PaymentStatus.
 * See the worked example on
 * https://developers.paynow.co.zw/docs/paynow/generating_hash/, which
 * uses this same constant. */
const INITIATE_TRANSACTION_STATUS_FIELD = 'Message'

export class InvalidPaynowCallbackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPaynowCallbackError'
  }
}

export class PaynowResponseError extends Error {
  readonly raw?: unknown

  constructor(message: string, raw?: unknown) {
    super(message)
    this.name = 'PaynowResponseError'
    this.raw = raw
  }
}

export interface PaynowProviderOptions {
  /** Defaults to `loadPaynowConfig()` (reads from `process.env`). Pass
   * explicitly in tests to avoid depending on environment variables. */
  config?: PaynowConfig
  /** Defaults to `FetchPaynowHttpClient`. Pass a fake in tests — no
   * real network access or credentials required. */
  httpClient?: PaynowHttpClient
  /** Defaults to `['USD']`. See the currency note in the file header. */
  supportedCurrencies?: string[]
}

export class PaynowProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'paynow'
  readonly supportsRefunds = false

  private readonly config: PaynowConfig
  private readonly http: PaynowHttpClient
  private readonly supportedCurrencies: Set<string>

  constructor(options: PaynowProviderOptions = {}) {
    this.config = options.config ?? loadPaynowConfig()
    this.http = options.httpClient ?? new FetchPaynowHttpClient()
    this.supportedCurrencies = new Set(
      (options.supportedCurrencies ?? ['USD']).map(c => c.toUpperCase()),
    )
  }

  supports(currency: CurrencyCode): boolean {
    return this.supportedCurrencies.has(currency.toUpperCase())
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.supports(input.currency)) {
      return {
        success: false,
        errorMessage: `Paynow provider does not support currency "${input.currency}"`,
      }
    }

    const resultUrl = input.resultUrl ?? this.config.resultUrl
    const returnUrl = input.returnUrl ?? this.config.returnUrl
    if (!resultUrl) {
      return { success: false, errorMessage: 'No resultUrl provided or configured for Paynow' }
    }
    if (!returnUrl) {
      return { success: false, errorMessage: 'No returnUrl provided or configured for Paynow' }
    }

    let decimalAmount: string
    try {
      decimalAmount = minorUnitsToDecimalString(input.amount)
    } catch (err: unknown) {
      return { success: false, errorMessage: (err as Error).message }
    }

    // additionalinfo is Paynow's free-text line-item/description field
    // for a simple (non-cart) transaction.
    const additionalInfo = input.description ?? `Order ${input.orderId}`

    // Field order here MUST match the order used in `hashInputValues`
    // below — Paynow's hash is positional, not keyed. This order
    // matches the worked example at
    // https://developers.paynow.co.zw/docs/paynow/generating_hash/
    // (id, reference, amount, additionalinfo, returnurl, resulturl, status).
    const hashInputValues = [
      this.config.integrationId,
      input.merchantReference,
      decimalAmount,
      additionalInfo,
      returnUrl,
      resultUrl,
      INITIATE_TRANSACTION_STATUS_FIELD,
    ]
    const hash = computeSignature(hashInputValues, this.config.integrationKey)

    const requestFields: Record<string, string> = {
      id: this.config.integrationId,
      reference: input.merchantReference,
      amount: decimalAmount,
      additionalinfo: additionalInfo,
      returnurl: returnUrl,
      resulturl: resultUrl,
      status: INITIATE_TRANSACTION_STATUS_FIELD,
      hash,
    }
    if (input.customerEmail) {
      requestFields.authemail = input.customerEmail
    }

    let rawResponseBody: string
    try {
      rawResponseBody = await this.http.postForm(PAYNOW_INITIATE_TRANSACTION_URL, requestFields)
    } catch (err: unknown) {
      const message = err instanceof PaynowTransportError ? err.message : 'Failed to reach Paynow'
      return { success: false, errorMessage: message, raw: err }
    }

    const pairs = parseFormEncoded(rawResponseBody)
    const parsed = pairsToLowercaseKeyedObject(pairs)

    if ((parsed.status ?? '').toLowerCase() !== 'ok') {
      return {
        success: false,
        errorMessage: parsed.error || 'Paynow rejected the initiate-transaction request',
        raw: parsed,
      }
    }

    // A successful initiate-transaction response is itself a Paynow
    // message and carries its own hash — validate it the same way any
    // other inbound Paynow message is validated, per
    // https://developers.paynow.co.zw/docs/paynow/initiate_transaction/
    // ("It is vital that the merchant site verify the hash value...").
    if (!verifyInboundHash(pairs, this.config.integrationKey)) {
      return {
        success: false,
        errorMessage: 'Paynow initiate-transaction response failed hash verification',
        raw: parsed,
      }
    }

    return {
      success: true,
      redirectUrl: parsed.browserurl,
      pollUrl: parsed.pollurl,
      raw: parsed,
    }
  }

  async getPaymentStatus(providerReferenceOrPollUrl: string): Promise<PaymentStatusResult> {
    // Paynow's status-check mechanism is poll-URL based, not
    // reference-based (see
    // https://developers.paynow.co.zw/docs/paynow/polling_status/) — a
    // poll URL is what `createPayment` returns as `pollUrl`, and it's
    // opaque to us, so this method only supports being called with it.
    let rawResponseBody: string
    try {
      rawResponseBody = await this.http.getRaw(providerReferenceOrPollUrl)
    } catch (err: unknown) {
      throw err instanceof PaynowTransportError
        ? err
        : new PaynowResponseError('Failed to reach Paynow while polling for status', err)
    }

    const pairs = parseFormEncoded(rawResponseBody)
    if (!verifyInboundHash(pairs, this.config.integrationKey)) {
      throw new InvalidPaynowCallbackError('Paynow poll response failed hash verification')
    }

    const parsed = pairsToLowercaseKeyedObject(pairs)
    if (!parsed.status) {
      throw new PaynowResponseError('Paynow poll response is missing a status field', parsed)
    }

    return {
      status: mapPaynowStatus(parsed.status),
      providerReference: parsed.paynowreference || undefined,
      paidAmount: parsed.amount ? decimalStringToMinorUnits(parsed.amount) : undefined,
      raw: parsed,
    }
  }

  /** Validates and interprets an inbound Paynow status-update message
   * (a POST to the merchant's `resulturl`). Pure translation only — no
   * database access, no idempotency bookkeeping — that orchestration is
   * Phase 8's responsibility (see PaymentService.handleProviderCallback,
   * which already treats a repeated identical status as a no-op at the
   * application level; this method's job is only to turn a validated
   * raw payload into a `CallbackHandlingResult` the same way every
   * time it is given the same input, so re-delivery is naturally safe
   * to re-process there).
   *
   * Throws `InvalidPaynowCallbackError` — never returns a "best guess"
   * result — if the hash is missing/invalid, or required fields are
   * absent. */
  async handleCallback(rawPayload: unknown): Promise<CallbackHandlingResult> {
    const pairs = normalizeInboundPayload(rawPayload)

    if (!verifyInboundHash(pairs, this.config.integrationKey)) {
      throw new InvalidPaynowCallbackError('Paynow callback failed hash verification')
    }

    const parsed = pairsToLowercaseKeyedObject(pairs)

    if (!parsed.reference) {
      throw new InvalidPaynowCallbackError('Paynow callback is missing the "reference" field')
    }
    if (!parsed.status) {
      throw new InvalidPaynowCallbackError('Paynow callback is missing the "status" field')
    }

    return {
      merchantReference: parsed.reference,
      status: mapPaynowStatus(parsed.status),
      providerReference: parsed.paynowreference || undefined,
      paidAmount: parsed.amount ? decimalStringToMinorUnits(parsed.amount) : undefined,
      raw: parsed,
    }
  }
}

/** Converts the app's integer minor-unit amount (e.g. cents) to the
 * decimal string format Paynow's API expects (e.g. 1000 -> "10.00").
 * This conversion happens ONLY at this adapter boundary — the rest of
 * the app, including the DB, stays in minor units throughout, per the
 * Phase 7 brief. */
function minorUnitsToDecimalString(amount: MinorUnits): string {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(
      `Amount must be a non-negative integer number of minor units, got: ${amount}`,
    )
  }
  return (amount / 100).toFixed(2)
}

/** Inverse of `minorUnitsToDecimalString`, for amounts Paynow reports
 * back to us (e.g. "10.00" -> 1000). */
function decimalStringToMinorUnits(decimalAmount: string): MinorUnits {
  const value = Number(decimalAmount)
  if (Number.isNaN(value)) {
    throw new PaynowResponseError(`Paynow returned a non-numeric amount: "${decimalAmount}"`)
  }
  return Math.round(value * 100)
}

function pairsToLowercaseKeyedObject(pairs: Array<[string, string]>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of pairs) {
    result[key.toLowerCase()] = value
  }
  return result
}

/** Normalizes the various shapes `rawPayload` might arrive in from a
 * route handler into the order-preserving `[key, value]` pair list that
 * `verifyInboundHash` needs.
 *
 * The safest input is the raw request body string or a `URLSearchParams`
 * built directly from it — both guarantee Paynow's original field
 * order is preserved, which the hash check depends on.
 *
 * A plain object is also accepted (e.g. if a Phase 8 route handler uses
 * a body parser that already decoded the form body into an object)
 * PROVIDED its key insertion order matches the order Paynow sent the
 * fields in — true for `Object.fromEntries` over a correctly-ordered
 * parse, but NOT guaranteed for an object built by other means (e.g.
 * one that's been spread, merged, or reconstructed from a Map/Record
 * that reordered keys). Phase 8 should prefer passing the raw body
 * string when possible; this fallback exists for convenience/testing,
 * not as the recommended integration path. */
function normalizeInboundPayload(rawPayload: unknown): Array<[string, string]> {
  if (typeof rawPayload === 'string') {
    return parseFormEncoded(rawPayload)
  }

  if (rawPayload instanceof URLSearchParams) {
    return Array.from(rawPayload.entries())
  }

  if (rawPayload && typeof rawPayload === 'object') {
    return Object.entries(rawPayload as Record<string, unknown>).map(
      ([key, value]): [string, string] => [key, String(value)],
    )
  }

  throw new InvalidPaynowCallbackError(
    `Unsupported Paynow callback payload shape: ${typeof rawPayload}`,
  )
}

export { PaynowConfigError }
