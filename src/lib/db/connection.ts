// src/lib/db/connection.ts
//
// The application's MongoDB connection.
//
// Uses `mongoose.createConnection()` (a dedicated Connection instance)
// rather than the global mongoose singleton, so models are registered on a
// connection this application owns and scripts/tests can open and close it
// independently.
//
// The connection is established lazily on first use and cached: Next.js
// route handlers and server components run per request, and reconnecting
// per request would exhaust the server's connection pool.

import mongoose, { type Connection } from 'mongoose'

let cachedConnection: Connection | null = null
let connectingPromise: Promise<Connection> | null = null

const getDatabaseUri = (): string => {
  const uri = process.env.DATABASE_URI
  if (!uri) {
    throw new Error(
      'DATABASE_URI is not set. See .env.example for the variables this ' +
        'application requires.',
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

/** For scripts and tests that need a clean shutdown. Request-scoped code
 * never calls this: the connection is deliberately long-lived there. */
export const closeDbConnection = async (): Promise<void> => {
  if (cachedConnection) {
    await cachedConnection.close()
    cachedConnection = null
  }
}
