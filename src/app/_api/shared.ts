// src/app/_api/shared.ts
//
// ARCHITECTURE NOTE:
// During `yarn build:next`, the script sets NEXT_BUILD=true and runs a local
// Express+Payload server on port 3000. Next.js static generation fetches data
// from this local server. At runtime on Vercel, that local server does not
// exist — only the public NEXT_PUBLIC_SERVER_URL does.
//
// NEXT_PUBLIC_* variables are inlined at compile time by Next.js webpack,
// so we CANNOT use them to switch between build-time and runtime URLs.
//
// Instead we use INTERNAL_SERVER_URL (a plain server-side env var, never
// inlined) which is ONLY set during the build step via the build script.
// At runtime it is undefined, so we fall back to NEXT_PUBLIC_SERVER_URL.
//
// This means:
//   Build time:   INTERNAL_SERVER_URL=http://127.0.0.1:3000  (set by build script)
//   Runtime:      NEXT_PUBLIC_SERVER_URL=https://your-domain  (set in Vercel dashboard)

export const GRAPHQL_API_URL =
  process.env.INTERNAL_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
