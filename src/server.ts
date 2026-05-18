// src/server.ts
import dotenv from 'dotenv'
import next from 'next'
import nextBuild from 'next/dist/build'
import path from 'path'

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
})

import express from 'express'
import payload from 'payload'

import { seed } from './payload/seed'

const app = express()
const PORT = process.env.PORT || 3000

const start = async (): Promise<void> => {
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

start()
