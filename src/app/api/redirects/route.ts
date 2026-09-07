// src/app/api/redirects/route.ts
//
// GET /api/redirects — the enabled redirect rules.
//
// Read by the middleware, which cannot open a database connection itself
// (it runs on the Edge runtime, where Mongoose does not work). Keeping the
// lookup here means one place owns the query and the middleware stays a
// thin, cached consumer.
//
// Public: every rule here is a public URL mapping, and the storefront's
// own redirects are observable by following them. Disabled rules are never
// returned, so an operator can stage one without it taking effect.

import { NextResponse } from 'next/server'

import { getRepositories } from '../../_api/repositories'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  try {
    const { redirects } = await getRepositories()
    const rules = await redirects.list(true)

    return NextResponse.json(
      {
        redirects: rules.map(rule => ({
          from: rule.from,
          to: rule.to,
          permanent: rule.permanent,
        })),
      },
      {
        // Short cache: an operator adding a redirect expects it to work
        // within a minute, and this is on the path of every request that
        // misses the middleware's own cache.
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
      },
    )
  } catch (error: unknown) {
    // A redirect table that cannot be read must not take the site down:
    // respond with no rules and let the request proceed normally.
    // eslint-disable-next-line no-console
    console.error('redirect lookup failed:', error)
    return NextResponse.json({ redirects: [] }, { status: 200 })
  }
}
