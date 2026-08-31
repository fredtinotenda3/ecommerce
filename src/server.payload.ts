// src/server.payload.ts
//
// PHASE 13A — the EXISTING Payload+Express+Next.js boot path, extracted
// verbatim (same behavior, same log lines, same NEXT_BUILD/PAYLOAD_SEED
// handling) from what used to be `src/server.ts`'s body. This is still
// the DEFAULT path — `src/server.ts` calls `startPayloadServer()` from
// here unless `USE_NATIVE_SERVER=true`, in which case it calls
// `startNativeServer()` from `./server.native` instead (see that file's
// header comment for why the split exists).
//
// No behavior change versus the pre-Phase-13a `src/server.ts`. This file
// still imports and initializes `payload`, exactly as before.

import express from 'express'
import next from 'next'
import nextBuild from 'next/dist/build'
import path from 'path'
import payload from 'payload'

import { seed } from './payload/seed'

const app = express()
const PORT = process.env.PORT || 3000

export const startPayloadServer = async (): Promise<void> => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || '',
    express: app,
    onInit: () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`)
    },
  })

  if (process.env.PAYLOAD_SEED === 'true') {
    await seed(payload)
    process.exit()
  }

  if (process.env.NEXT_BUILD) {
    payload.logger.info(`Starting build server on port ${PORT}...`)

    await new Promise<void>((resolve, reject) => {
      const server = app.listen(PORT, async () => {
        payload.logger.info(`Build server ready at http://127.0.0.1:${PORT}`)

        // CRITICAL: Set INTERNAL_SERVER_URL so that all fetch() calls inside
        // the Next.js build process (static generation, generateStaticParams, etc.)
        // hit the local Payload server instead of NEXT_PUBLIC_SERVER_URL.
        // This variable is NOT inlined by Next.js webpack (only NEXT_PUBLIC_* are),
        // so it is read fresh at runtime inside the build worker processes.
        process.env.INTERNAL_SERVER_URL = `http://127.0.0.1:${PORT}`

        // Give the server time to be fully ready before Next.js starts
        // making API requests during static page generation
        await new Promise(r => setTimeout(r, 3000))

        try {
          // @ts-expect-error
          await nextBuild(path.join(__dirname, '../'))
          payload.logger.info('Next.js build completed successfully')
          server.close(() => resolve())
        } catch (error: unknown) {
          payload.logger.error('Next.js build failed:', error)
          server.close(() => reject(error))
        }
      })

      server.on('error', reject)
    })

    process.exit(0)
    return
  }

  // Production runtime — serve Next.js through Express + Payload
  const nextApp = next({
    dev: process.env.NODE_ENV !== 'production',
  })

  const nextHandler = nextApp.getRequestHandler()

  app.use((req, res) => nextHandler(req, res))

  nextApp.prepare().then(() => {
    payload.logger.info('Starting Next.js...')
    app.listen(PORT, async () => {
      payload.logger.info(`Next.js App URL: ${process.env.PAYLOAD_PUBLIC_SERVER_URL}`)
    })
  })
}
