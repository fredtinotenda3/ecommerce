// scripts/validation/checkStripeConfig.ts
//
// PHASE 12 — read-only pre-cutover helper. Confirms that the EXISTING
// Stripe/Payload payment path still has the credentials it needs, i.e.
// that rolling USE_PAYNOW_CHECKOUT back to false (or never enabling it)
// remains a viable fallback at any point during the cutover.
//
// This mirrors the exact env vars read by src/payload/payload.config.ts's
// stripe plugin block:
//   - STRIPE_SECRET_KEY
//   - PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY
//   - STRIPE_WEBHOOKS_SIGNING_SECRET
// and the client-side publishable key used by the storefront's Stripe
// Elements form:
//   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
//
// Deliberately:
//   - has ZERO network calls to Stripe — only checks presence/shape of
//     env vars, never validates them against Stripe's API.
//   - never logs STRIPE_SECRET_KEY or STRIPE_WEBHOOKS_SIGNING_SECRET in
//     full — only a masked prefix, to confirm "test" vs "live" key type
//     without exposing the secret.
//   - does not import payload or connect to any database.
//
// Usage:
//   npx ts-node -T scripts/validation/checkStripeConfig.ts

import 'dotenv/config'

const line = (char: string, length = 78): string => char.repeat(length)

const maskSecret = (value: string): string => {
  if (value.length <= 12) return '<set, too short to safely display prefix>'
  return `${value.slice(0, 11)}${'*'.repeat(Math.max(0, value.length - 11))}`
}

const keyKind = (value: string): string => {
  if (value.startsWith('sk_live_')) return 'LIVE secret key'
  if (value.startsWith('sk_test_')) return 'TEST secret key'
  if (value.startsWith('rk_live_')) return 'LIVE restricted key'
  if (value.startsWith('rk_test_')) return 'TEST restricted key'
  return 'unrecognized key format'
}

const publishableKeyKind = (value: string): string => {
  if (value.startsWith('pk_live_')) return 'LIVE publishable key'
  if (value.startsWith('pk_test_')) return 'TEST publishable key'
  return 'unrecognized key format'
}

const main = (): void => {
  console.log(line('='))
  console.log('PHASE 12 — Stripe configuration check (read-only, no network calls)')
  console.log(line('='))
  console.log('')
  console.log('Purpose: confirm the EXISTING Stripe checkout path (the rollback target')
  console.log('for USE_PAYNOW_CHECKOUT) still has valid-looking credentials configured.')
  console.log('')

  let hadFailure = false

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.error('FAIL: STRIPE_SECRET_KEY is not set. Rolling back to Stripe checkout would break.')
    hadFailure = true
  } else {
    console.log(`STRIPE_SECRET_KEY: ${maskSecret(secretKey)} (${keyKind(secretKey)})`)
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    console.error(
      'FAIL: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. The storefront Stripe Elements form will not render.',
    )
    hadFailure = true
  } else {
    console.log(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${maskSecret(publishableKey)} (${publishableKeyKind(publishableKey)})`)
  }

  const webhookSecret = process.env.STRIPE_WEBHOOKS_SIGNING_SECRET
  if (!webhookSecret) {
    console.log(
      'WARNING: STRIPE_WEBHOOKS_SIGNING_SECRET is not set. Stripe webhook signature ' +
        'verification will fail; existing orders relying on the webhook to confirm ' +
        'payment will not update.',
    )
  } else {
    console.log(`STRIPE_WEBHOOKS_SIGNING_SECRET: ${maskSecret(webhookSecret)}`)
  }

  const isTestKeyFlag = process.env.PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY
  console.log(`PAYLOAD_PUBLIC_STRIPE_IS_TEST_KEY: ${isTestKeyFlag ?? '(unset, treated as false/live)'}`)

  console.log('')
  console.log(line('-'))

  if (secretKey && publishableKey) {
    const secretIsLive = secretKey.startsWith('sk_live_') || secretKey.startsWith('rk_live_')
    const publishableIsLive = publishableKey.startsWith('pk_live_')
    if (secretIsLive !== publishableIsLive) {
      console.error(
        'FAIL: STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY appear to be from ' +
          'different modes (one live, one test). This mismatch will break checkout.',
      )
      hadFailure = true
    }
  }

  if (hadFailure) {
    console.error('')
    console.error('RESULT: FAIL — the Stripe rollback path is not currently safe to rely on.')
    console.log(line('='))
    process.exitCode = 1
  } else {
    console.log('')
    console.log('PASS: Stripe rollback path has the credentials it needs.')
    console.log(line('='))
  }
}

main()
