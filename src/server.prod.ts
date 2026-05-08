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
  // Initialize Payload first
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

  // Build mode - must have server running for API routes
  if (process.env.NEXT_BUILD === 'true') {
    payload.logger.info(`Starting build server on port ${PORT}...`)

    const server = app.listen(PORT, async () => {
      payload.logger.info(`Build server ready: http://localhost:${PORT}`)

      // Give the server a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 2000))

      try {
        // @ts-expect-error
        await nextBuild(path.join(__dirname, '../'))
        payload.logger.info('Build completed successfully')
        server.close(() => process.exit(0))
      } catch (error: unknown) {
        payload.logger.error('Build failed:', error)
        server.close(() => process.exit(1))
      }
    })

    return
  }

  // Production mode
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
