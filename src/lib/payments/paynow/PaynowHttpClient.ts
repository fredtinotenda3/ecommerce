// src/lib/payments/paynow/PaynowHttpClient.ts
//
// Thin transport abstraction over Paynow's REST API
// (https://developers.paynow.co.zw/docs/paynow/paynow_api/). Every
// Paynow endpoint used here speaks `application/x-www-form-urlencoded`
// both ways: requests are form-encoded, and — unusually — so are
// responses (a `key=value&key2=value2...` string, not JSON).
//
// This is injected into PaynowProvider rather than called directly so
// tests can substitute a fake client and exercise createPayment/
// getPaymentStatus without any real network access or credentials.

export interface PaynowHttpClient {
  /** POSTs `fields` as an `application/x-www-form-urlencoded` body to
   * `url` and returns the raw response body text (itself
   * form-encoded — callers parse it with `parseFormEncoded`). */
  postForm(url: string, fields: Record<string, string>): Promise<string>

  /** GETs `url` (a Paynow-issued poll URL) and returns the raw
   * form-encoded response body text. */
  getRaw(url: string): Promise<string>
}

export class PaynowTransportError extends Error {
  readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'PaynowTransportError'
    this.cause = cause
  }
}

/** Default `PaynowHttpClient` backed by the platform's global `fetch`
 * (available natively on Node 18+, no extra dependency required). */
export class FetchPaynowHttpClient implements PaynowHttpClient {
  async postForm(url: string, fields: Record<string, string>): Promise<string> {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      })
    } catch (err: unknown) {
      throw new PaynowTransportError(`Failed to reach Paynow at ${url}`, err)
    }

    return response.text()
  }

  async getRaw(url: string): Promise<string> {
    let response: Response
    try {
      response = await fetch(url)
    } catch (err: unknown) {
      throw new PaynowTransportError(`Failed to reach Paynow at ${url}`, err)
    }

    return response.text()
  }
}
