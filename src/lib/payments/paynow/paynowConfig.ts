// src/lib/payments/paynow/paynowConfig.ts
//
// Server-side-only configuration for the Paynow provider. This module
// must never be imported from client/browser code — it reads secrets
// (PAYNOW_INTEGRATION_KEY) straight out of `process.env`, deliberately
// WITHOUT a `NEXT_PUBLIC_` prefix, so Next.js never inlines them into a
// client bundle. Nothing here should be re-exported through a "use
// client" module.

export type PaynowMode = 'test' | 'live'

export interface PaynowConfig {
  /** Paynow-issued Integration ID (`PAYNOW_INTEGRATION_ID`). */
  integrationId: string
  /** Paynow-issued Integration Key, used only for hash
   * generation/validation — never sent in any request body
   * (`PAYNOW_INTEGRATION_KEY`). */
  integrationKey: string
  /** Default resultUrl (Paynow's async status-update callback target)
   * used when `CreatePaymentInput.resultUrl` is not supplied per-call
   * (`PAYNOW_RESULT_URL`). */
  resultUrl?: string
  /** Default returnUrl (where the customer's browser is redirected
   * after paying) used when `CreatePaymentInput.returnUrl` is not
   * supplied per-call (`PAYNOW_RETURN_URL`). */
  returnUrl?: string
  /** `PAYNOW_MODE`. NOTE (assumption, see Phase 7 report): unlike some
   * providers, Paynow does not expose a separate sandbox base URL —
   * "test mode" is a property of which Integration ID/Key pair you use
   * (an integration starts in test mode until Paynow support "sets it
   * live"; see https://developers.paynow.co.zw/docs/paynow/test_mode/).
   * This flag does NOT change which Paynow endpoint is called; it's
   * threaded through purely so calling code / logs can assert which
   * environment a given set of credentials is expected to belong to.
   * Defaults to 'test' — the safer default — if unset or unrecognized. */
  mode: PaynowMode
}

export class PaynowConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaynowConfigError'
  }
}

/** Loads and validates Paynow configuration from environment variables.
 * Throws `PaynowConfigError` if required credentials are missing —
 * deliberately fails fast/loud rather than allowing a PaynowProvider to
 * be constructed in a half-configured state. */
export type PaynowEnv = Record<string, string | undefined>

export function loadPaynowConfig(env: PaynowEnv = process.env): PaynowConfig {
  const integrationId = env.PAYNOW_INTEGRATION_ID
  const integrationKey = env.PAYNOW_INTEGRATION_KEY

  if (!integrationId) {
    throw new PaynowConfigError('PAYNOW_INTEGRATION_ID is not set')
  }
  if (!integrationKey) {
    throw new PaynowConfigError('PAYNOW_INTEGRATION_KEY is not set')
  }

  const mode: PaynowMode = env.PAYNOW_MODE === 'live' ? 'live' : 'test'

  return {
    integrationId,
    integrationKey,
    resultUrl: env.PAYNOW_RESULT_URL || undefined,
    returnUrl: env.PAYNOW_RETURN_URL || undefined,
    mode,
  }
}
