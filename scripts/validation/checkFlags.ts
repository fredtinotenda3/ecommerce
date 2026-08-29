// scripts/validation/checkFlags.ts
//
// PHASE 11 — lightweight, read-only helper for a staging environment.
// Prints the current value and effective (on/off) state of every
// migration-related feature flag, plus a one-line reminder of what that
// state means for the running app. Deliberately:
//
//   - has ZERO dependencies beyond Node's own `process.env` — no DB
//     connection, no network call, no Payload/Mongoose import — so it is
//     always safe to run in any environment, including one with no
//     configured database at all.
//   - read-only: it never writes to `.env`, never mutates process state,
//     never calls any external service.
//   - uses the exact same flag-reading helpers the app itself uses
//     (src/app/_api/*Flag.ts, src/app/_api/dataSource.ts), so its output
//     can never drift out of sync with actual runtime behavior.
//
// Usage:
//   npx ts-node -T scripts/validation/checkFlags.ts
//   npm run validate:flags
//
// This does not replace the manual smoke-test checklist in
// docs/parallel-validation.md — it only answers "which code paths are
// live right now", which is the first thing worth checking before
// running through that checklist.

import { isNativeAdminEnabled } from '../../src/app/_api/adminFlag'
import { isNativeAuthEnabled } from '../../src/app/_api/authFlag'
import { isNativeRepositoryEnabled } from '../../src/app/_api/dataSource'
import { isPaynowCheckoutEnabled } from '../../src/app/_api/paynowCheckoutFlag'

interface FlagStatus {
  envVar: string
  enabled: boolean
  whenOn: string
  whenOff: string
}

const flags: FlagStatus[] = [
  {
    envVar: 'USE_NATIVE_REPOSITORY',
    enabled: isNativeRepositoryEnabled(),
    whenOn: 'Storefront category/product/page reads use the native repository path.',
    whenOff: 'Storefront reads use the existing Payload GraphQL fetchDoc/fetchDocs path (default).',
  },
  {
    envVar: 'USE_NATIVE_AUTH',
    enabled: isNativeAuthEnabled(),
    whenOn: '/api/auth-native/* routes are live and issue native-session cookies.',
    whenOff: '/api/auth-native/* routes all respond 404. Payload /api/users/* auth is unaffected either way.',
  },
  {
    envVar: 'USE_NATIVE_ADMIN',
    enabled: isNativeAdminEnabled(),
    whenOn: '/native-admin/* is reachable to an authorized admin (also requires USE_NATIVE_AUTH=true).',
    whenOff: '/native-admin/* responds 404 for every request, regardless of session.',
  },
  {
    envVar: 'USE_PAYNOW_CHECKOUT',
    enabled: isPaynowCheckoutEnabled(),
    whenOn: 'Checkout page renders the Paynow flow; /api/checkout/paynow/* and /api/payments/paynow/* are live.',
    whenOff: 'Checkout page renders the existing Stripe flow (default). Paynow routes all respond 404.',
  },
]

const line = (char: string, length = 78): string => char.repeat(length)

console.log(line('='))
console.log('PHASE 11 — Feature flag status (read-only, no DB/network access)')
console.log(line('='))

for (const flag of flags) {
  const rawValue = process.env[flag.envVar]
  const displayValue = rawValue === undefined ? '(unset)' : JSON.stringify(rawValue)
  console.log('')
  console.log(`${flag.envVar}=${displayValue}`)
  console.log(`  -> ${flag.enabled ? 'ON ' : 'OFF'}: ${flag.enabled ? flag.whenOn : flag.whenOff}`)
}

console.log('')
console.log(line('-'))
const anyNativeOn = flags.some(f => f.enabled)
if (!anyNativeOn) {
  console.log('All flags are off/unset — this environment is behaviorally identical to pre-Phase-2 production.')
} else {
  console.log('At least one flag is ON. Cross-check against docs/parallel-validation.md before treating this as a production-safe configuration.')
}
console.log(line('='))
