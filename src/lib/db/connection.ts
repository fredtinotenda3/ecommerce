// src/lib/db/connection.ts
//
// Native MongoDB connection for the new application layer.
//
// IMPORTANT: This is intentionally a SEPARATE Mongoose connection from the
// one Payload's @payloadcms/db-mongodb adapter manages internally via the
// default `mongoose` singleton connection during payload.init(). We use
// `mongoose.createConnection()` (a distinct Connection instance) rather than
// the default global connection so that:
//
//   1. This module can be imported and used independently of whether
//      Payload has initialized yet (needed for standalone scripts/tests).
//   2. We never risk double-registering a model name against the same
//      global mongoose singleton that Payload also registers models on
//      (Payload registers models named e.g. "products" on the DEFAULT
//      connection — see node_modules/@payloadcms/db-mongodb/dist/init.js).
//
// Both connections point at the SAME `DATABASE_URI` / same physical
// database. They are two separate driver-level connections to one
// database, not two databases. This is a deliberate, temporary
// arrangement for the incremental migration — once Payload is removed
// (a future phase), this becomes the only connection.
//
// This module does not connect eagerly on import. Call `getDbConnection()`
// wherever a repository needs the database; it establishes (or reuses) the
// connection lazily and caches it.

import mongoose, { type Connection } from 'mongoose'

let cachedConnection: Connection | null = null
let connectingPromise: Promise<Connection> | null = null

const getDatabaseUri = (): string => {
  const uri = process.env.DATABASE_URI
  if (!uri) {
    throw new Error(
      'DATABASE_URI is not set. The native application layer requires the same ' +
        'DATABASE_URI already used by Payload (see .env / .env.example).',
    )
  }
  return uri
}

export const getDbConnection = async (): Promise<Connection> => {
  if (cachedConnection && cachedConnection.readyState === 1) {
    return cachedConnection
  }

  if (connectingPromise) {
    return connectingPromise
  }

  connectingPromise = new Promise<Connection>((resolve, reject) => {
    const connection = mongoose.createConnection(getDatabaseUri())

    connection.once('open', () => {
      cachedConnection = connection
      connectingPromise = null
      resolve(connection)
    })

    connection.once('error', err => {
      connectingPromise = null
      reject(err)
    })
  })

  return connectingPromise
}

/** For tests and scripts that need a clean shutdown. Not used by request-
 * scoped Next.js code paths (the connection is intentionally long-lived
 * there, matching standard Mongoose-in-serverless/Node patterns). */
export const closeDbConnection = async (): Promise<void> => {
  if (cachedConnection) {
    await cachedConnection.close()
    cachedConnection = null
  }
}