// src/app/_api/shared.ts

// CRITICAL: Do NOT use NEXT_BUILD here — it is set at build time via cross-env
// and Next.js will inline it as "true" into the compiled bundle, causing all
// runtime requests to hit 127.0.0.1:3000 which does not exist on Vercel.
//
// NEXT_PUBLIC_SERVER_URL is the correct variable to use here — it is set in
// Vercel environment variables and resolves to the actual deployed URL at runtime.

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL

if (!serverURL && typeof window === 'undefined') {
  console.warn(
    '[shared.ts] NEXT_PUBLIC_SERVER_URL is not defined. API calls will fail. ' +
      'Set this environment variable in your Vercel project settings.',
  )
}

export const GRAPHQL_API_URL = serverURL || 'http://localhost:3000'
