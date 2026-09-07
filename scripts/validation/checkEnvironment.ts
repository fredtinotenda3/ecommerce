// scripts/validation/checkEnvironment.ts
//
// Read-only preflight: reports which required environment variables are
// present and which are missing, without connecting to anything.
//
// Secrets are never printed — only whether a value is set, and its length
// where that is a useful signal (a truncated SESSION_SECRET is a common
// deployment mistake). Run this before `validate:db` and `validate:paynow`,
// which do make real connections.
//
// Usage: npm run validate:env

export interface RequiredVar {
  name: string
  description: string
  /** Minimum sensible length, where one applies. */
  minLength?: number
}

const REQUIRED: RequiredVar[] = [
  { name: 'DATABASE_URI', description: 'MongoDB connection string' },
  {
    name: 'SESSION_SECRET',
    description: 'HMAC key for session tokens',
    minLength: 32,
  },
  { name: 'NEXT_PUBLIC_SERVER_URL', description: 'Public origin of this deployment' },
  { name: 'PAYNOW_INTEGRATION_ID', description: 'Paynow integration id' },
  { name: 'PAYNOW_INTEGRATION_KEY', description: 'Paynow integration key' },
]

const OPTIONAL: RequiredVar[] = [
  { name: 'PAYNOW_MODE', description: 'test | live (defaults to test)' },
  { name: 'PAYNOW_RESULT_URL', description: 'Explicit callback URL' },
  { name: 'PAYNOW_RETURN_URL', description: 'Explicit browser return URL' },
  { name: 'NEXT_PUBLIC_IS_LIVE', description: 'Unset means responses are noindex' },
  { name: 'NEXT_PRIVATE_DRAFT_SECRET', description: 'Secret for /api/preview' },
  { name: 'NEXT_PRIVATE_REVALIDATION_KEY', description: 'Secret for /api/revalidate' },
]

/* eslint-disable no-console */
const report = (vars: RequiredVar[], required: boolean): number => {
  let missing = 0

  for (const entry of vars) {
    const value = process.env[entry.name]
    const isSet = typeof value === 'string' && value.length > 0

    if (!isSet) {
      if (required) missing += 1
      console.log(`${required ? '✗' : '-'} ${entry.name} — not set (${entry.description})`)
      continue
    }

    if (entry.minLength && value.length < entry.minLength) {
      missing += 1
      console.log(
        `✗ ${entry.name} — set but only ${value.length} characters; expected at least ${entry.minLength}`,
      )
      continue
    }

    console.log(`✓ ${entry.name} — set`)
  }

  return missing
}

const main = (): void => {
  console.log('Required:')
  const missing = report(REQUIRED, true)

  console.log('\nOptional:')
  report(OPTIONAL, false)

  if (missing > 0) {
    console.error(`\n${missing} required variable(s) missing or invalid.`)
    process.exit(1)
  }

  console.log('\nAll required variables are set.')
}

main()
/* eslint-enable no-console */
