// tests/fakes/FakePaynowHttpClient.ts
import type { PaynowHttpClient } from '../../src/lib/payments/paynow/PaynowHttpClient'

/** Records calls and returns pre-programmed responses — no real network
 * access, matching the Phase 7 brief's requirement that provider tests
 * not require real Paynow credentials or network access. */
export class FakePaynowHttpClient implements PaynowHttpClient {
  public postFormCalls: Array<{ url: string; fields: Record<string, string> }> = []
  public getRawCalls: string[] = []

  public nextPostFormResponse: string | Error = ''
  public nextGetRawResponse: string | Error = ''

  async postForm(url: string, fields: Record<string, string>): Promise<string> {
    this.postFormCalls.push({ url, fields })
    if (this.nextPostFormResponse instanceof Error) {
      throw this.nextPostFormResponse
    }
    return this.nextPostFormResponse
  }

  async getRaw(url: string): Promise<string> {
    this.getRawCalls.push(url)
    if (this.nextGetRawResponse instanceof Error) {
      throw this.nextGetRawResponse
    }
    return this.nextGetRawResponse
  }
}
