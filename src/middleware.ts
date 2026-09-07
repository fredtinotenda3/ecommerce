// src/middleware.ts
//
// Applies operator-managed redirects (stored in MongoDB, edited at
// /admin/redirects) to incoming requests.
//
// Middleware runs on the Edge runtime, where Mongoose cannot open a
// connection, so the rules are fetched from /api/redirects — a Node-runtime
// route — and held in a module-scoped cache for REDIRECT_TTL_MS. That
// makes the steady-state cost of this middleware a map lookup, with one
// refetch per instance per minute.
//
// Failure is deliberately silent: if the rules cannot be fetched, requests
// carry on unredirected. A redirect table that is briefly unavailable
// should not take the site down.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

interface RedirectRule {
  from: string
  to: string
  permanent: boolean
}

const REDIRECT_TTL_MS = 60_000

let cache: { rules: Map<string, RedirectRule>; expiresAt: number } | null = null
let inFlight: Promise<Map<string, RedirectRule>> | null = null

/** Trailing slashes are stripped so `/old/` and `/old` match the same rule;
 * `/` itself is left alone. Matching is case-sensitive, as paths are. */
const normalizePath = (pathname: string): string =>
  pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

const loadRules = async (origin: string): Promise<Map<string, RedirectRule>> => {
  const now = Date.now()
  if (cache && cache.expiresAt > now) return cache.rules

  // Collapse concurrent refreshes into one request.
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch(`${origin}/api/redirects`, {
        headers: { accept: 'application/json' },
        // Next's own fetch cache would hold this beyond our TTL.
        cache: 'no-store',
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const body = (await response.json()) as { redirects?: RedirectRule[] }
      const rules = new Map<string, RedirectRule>()

      for (const rule of body.redirects ?? []) {
        if (rule?.from && rule?.to) rules.set(normalizePath(rule.from), rule)
      }

      cache = { rules, expiresAt: Date.now() + REDIRECT_TTL_MS }
      return rules
    } catch {
      // Cache the empty result briefly too, so a failing lookup does not
      // add a fetch to every single request.
      cache = { rules: cache?.rules ?? new Map(), expiresAt: Date.now() + REDIRECT_TTL_MS }
      return cache.rules
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const rules = await loadRules(request.nextUrl.origin)
  if (rules.size === 0) return NextResponse.next()

  const rule = rules.get(normalizePath(request.nextUrl.pathname))
  if (!rule) return NextResponse.next()

  const destination = rule.to.startsWith('/')
    ? new URL(rule.to, request.nextUrl.origin)
    : new URL(rule.to)

  // Preserve the query string: a redirect should not silently drop
  // campaign parameters or pagination.
  request.nextUrl.searchParams.forEach((value, key) => {
    if (!destination.searchParams.has(key)) destination.searchParams.set(key, value)
  })

  return NextResponse.redirect(destination, rule.permanent ? 308 : 307)
}

export const config = {
  // Everything except the API, Next's own assets, media files and the
  // handful of static files at the root. Redirecting an asset request
  // would break the page that asked for it.
  matcher: ['/((?!api/|_next/|media/|favicon.ico|robots.txt|sitemap.xml).*)'],
}
