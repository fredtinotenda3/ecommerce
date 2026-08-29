// scripts/validation/checkPaynowConfig.ts
//
// PHASE 12 — read-only pre-cutover helper. Confirms that Paynow
// credentials are present and structurally valid using the SAME loader
// the app uses (src/lib/payments/paynow/paynowConfig.ts), without ever
// printing the integration key or making a network call to Paynow.
//
// Deliberately:
//   - has ZERO network calls — it does not contact Paynow's API, so it
//     cannot trigger a real transaction and is safe to run anywhere,
//     including production, at any time.
//   - never logs PAYNOW_INTEGRATION_KEY. Only its presence/length is
//     reported, never its value.
//   - uses `loadPaynowConfig()` directly, so a PASS here means
//     `USE_PAYNOW_CHECKOUT=true` will not immediately throw
//     PaynowConfigError at request time.
//   - does NOT validate that the credentials are *correct* (only Paynow
//     can confirm that) — pair this with a manual test-mode payment
//     during the smoke-test step before flipping the flag in production.
//
// Usage:
//   npx ts-node -T scripts/validation/checkPaynowConfig.ts

import 'dotenv/config'
import { loadPaynowConfig, PaynowConfigError } from '../../src/lib/payments/paynow/paynowConfig'

const line = (char: string, length = 78): string => char.repeat(length)

const main = (): void => {
  console.log(line('='))
  console.log('PHASE 12 — Paynow configuration check (read-only, no network calls)')
  console.log(line('='))

  try {
    const config = loadPaynowConfig()

    console.log('')
    console.log(`PAYNOW_INTEGRATION_ID: ${config.integrationId}`)
    console.log(`PAYNOW_INTEGRATION_KEY: <present, length=${config.integrationKey.length}> (value not printed)`)
    console.log(`PAYNOW_RESULT_URL: ${config.resultUrl ?? '(unset — code paths that require it will fail)'}`)
    console.log(`PAYNOW_RETURN_URL: ${config.returnUrl ?? '(unset — code paths that require it will fail)'}`)
    console.log(`PAYNOW_MODE: ${config.mode}`)

    console.log('')
    console.log(line('-'))

    if (config.mode !== 'live') {
      console.log(
        'NOTE: PAYNOW_MODE is "test" (or unset). This is the safe default. Before ' +
          'enabling USE_PAYNOW_CHECKOUT=true in production, confirm this should be ' +
          '"live" and that PAYNOW_INTEGRATION_ID/KEY are the live pair, not the test pair.',
      )
    } else {
      console.log(
        'NOTE: PAYNOW_MODE=live. Confirm this environment is genuinely production and ' +
          'that the integration ID/key pair has been set live by Paynow support before ' +
          'accepting real customer payments.',
      )
    }

    if (!config.resultUrl || !config.returnUrl) {
      console.log('')
      console.log(
        'WARNING: PAYNOW_RESULT_URL and/or PAYNOW_RETURN_URL is unset. Callback and ' +
          'redirect-back flows may fail unless every call site supplies these explicitly.',
      )
    }

    console.log('')
    console.log('PASS: Paynow config loads without error (credentials are structurally present).')
    console.log(line('='))
  } catch (err) {
    console.error('')
    if (err instanceof PaynowConfigError) {
      console.error(`FAIL: ${err.message}`)
    } else {
      console.error(`FAIL: unexpected error while loading Paynow config: ${(err as Error).message}`)
    }
    console.error('      Set the missing PAYNOW_* variables before enabling USE_PAYNOW_CHECKOUT.')
    process.exitCode = 1
  }
}

main()
