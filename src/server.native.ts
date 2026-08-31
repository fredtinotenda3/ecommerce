// src/server.native.ts
//
// PHASE 13A — plain Next.js boot path, used only when
// `USE_NATIVE_SERVER=true`. Deliberately does NOT import or reference
// `payload`, `payload/config`, or anything under `src/payload/**` — that
// is the whole point of this file: it proves the app can start without
// Payload being initialized at all, which was Phase 13's blocker #1
// ("the app cannot currently boot without Payload").
//
// This is NOT the default. `src/server.ts` only calls
// `startNativeServer()` (from here) when the flag is on; otherwise it
// calls `startPayloadServer()` (see ./server.payload.ts), which is
// byte-for-byte the same Payload+Express+Next.js path the app has always
// used. Flipping the flag back to false/unset restores prior behavior
// exactly — no code change required.
//
// Why no local loopback server is needed for NEXT_BUILD here (unlike
// server.payload.ts's Payload-backed build path): the native storefront
// read paths (fetchCategoriesNative.ts, fetchProductNative.ts,
// fetchPageNative.ts, etc.) talk directly to MongoDB via
// `getDbConnection()` — they never fetch from a local HTTP API the way
// the GraphQL path does. So static generation under
// `USE_NATIVE_REPOSITORY=true` needs no local server standing in for
// Payload's GraphQL API; `next build` can run directly against the DB.
// (If `USE_NATIVE_REPOSITORY` is off while `USE_NATIVE_SERVER` is on,
// storefront reads would still try to reach Payload's GraphQL API over
// HTTP with no server to answer them — see this phase's report,
// "Remaining Blockers", for why `USE_NATIVE_SERVER=true` is only
// meaningful today alongside `USE_NATIVE_REPOSITORY=true`.)

import express from 'express'
import next from 'next'
import nextBuild from 'next/dist/build'
import path from 'path'

const PORT = process.env.PORT || 3000

/* eslint-disable no-console */
export const startNativeServer = async (): Promise<void> => {
  if (process.env.NEXT_BUILD) {
    console.log(
      '[native-server] Building Next.js (native repositories read MongoDB directly — ' +
        'no local Payload/Express loopback server needed)...',
    )

    // @ts-expect-error - same untyped internal Next.js build API
    // src/server.payload.ts already uses.
    await nextBuild(path.join(__dirname, '../'))

    console.log('[native-server] Next.js build completed successfully')
    process.exit(0)
    return
  }

  const app = express()
  const nextApp = next({
    dev: process.env.NODE_ENV !== 'production',
  })
  const nextHandler = nextApp.getRequestHandler()

  app.use((req, res) => nextHandler(req, res))

  await nextApp.prepare()
  console.log('[native-server] Starting Next.js (native server — Payload was never initialized)...')
  app.listen(PORT, () => {
    console.log(`[native-server] Next.js App URL: ${process.env.NEXT_PUBLIC_SERVER_URL}`)
  })
}
/* eslint-enable no-console */
