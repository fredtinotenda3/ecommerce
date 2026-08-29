// scripts/validation/checkDatabaseConnectivity.ts
//
// PHASE 12 — read-only pre-cutover helper. Confirms that DATABASE_URI is
// set and reachable using the SAME native connection module the app uses
// (src/lib/db/connection.ts), then reports basic, non-destructive facts
// about the target database: connection state, database name, and
// collection list with document counts.
//
// Deliberately:
//   - read-only: never writes, updates, deletes, or drops anything.
//   - does not touch Payload's own connection/init path — this only
//     exercises the native `mongoose.createConnection()` used by the
//     repositories/migration scripts, which is the connection that
//     matters for USE_NATIVE_REPOSITORY / migration correctness.
//   - safe to run against production or a production copy: it is
//     equivalent in risk to `mongosh --eval "db.stats()"`.
//   - closes its connection before exiting either way.
//
// Usage:
//   npx ts-node -T scripts/validation/checkDatabaseConnectivity.ts
//
// Exit code is 0 if the connection succeeded, 1 otherwise, so this can be
// used as a go/no-go gate in a manual runbook step or a CI job.

import 'dotenv/config'
import { getDbConnection, closeDbConnection } from '../../src/lib/db/connection'

const line = (char: string, length = 78): string => char.repeat(length)

const redactUri = (uri: string): string => {
  // Never print credentials, even locally in a terminal that might be
  // screen-shared or logged. Show only the scheme and host portion.
  try {
    const withoutCreds = uri.replace(/\/\/[^@]*@/, '//<redacted>@')
    return withoutCreds
  } catch {
    return '<unparseable URI, not printed>'
  }
}

const main = async (): Promise<void> => {
  console.log(line('='))
  console.log('PHASE 12 — Database connectivity check (read-only)')
  console.log(line('='))

  const rawUri = process.env.DATABASE_URI
  if (!rawUri) {
    console.error('')
    console.error('FAIL: DATABASE_URI is not set in the current environment.')
    console.error('      Set it (via .env or the deployment platform) before proceeding.')
    process.exitCode = 1
    return
  }

  console.log('')
  console.log(`DATABASE_URI: ${redactUri(rawUri)}`)

  try {
    const connection = await getDbConnection()
    console.log('')
    console.log(`Connection state: ${connection.readyState === 1 ? 'connected' : connection.readyState}`)
    console.log(`Database name:    ${connection.name}`)

    if (!connection.db) {
      throw new Error('Connection established but connection.db is unavailable.')
    }

    const collections = await connection.db.listCollections().toArray()
    console.log('')
    console.log(`Collections found: ${collections.length}`)
    console.log(line('-'))

    // Sorted for stable, diffable output across runs.
    const sortedNames = collections.map(c => c.name).sort((a, b) => a.localeCompare(b))

    for (const name of sortedNames) {
      try {
        const count = await connection.db.collection(name).estimatedDocumentCount()
        console.log(`  ${name.padEnd(40)} ~${count} docs`)
      } catch (err) {
        console.log(`  ${name.padEnd(40)} (count unavailable: ${(err as Error).message})`)
      }
    }

    console.log('')
    console.log(line('-'))
    console.log('PASS: database is reachable and readable.')
    console.log(line('='))
  } catch (err) {
    console.error('')
    console.error(`FAIL: could not connect to or read from the database.`)
    console.error(`      ${(err as Error).message}`)
    process.exitCode = 1
  } finally {
    await closeDbConnection()
  }
}

main()
