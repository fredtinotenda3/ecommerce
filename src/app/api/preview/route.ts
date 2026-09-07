// src/app/api/preview/route.ts
//
// GET /api/preview?url=&secret= — enables Next.js draft mode so a page can
// be viewed before it is published.
//
// Two independent checks must pass: a valid admin session, and the shared
// draft secret. The session check comes first so the secret is never
// exercised by an anonymous caller, and the redirect target is constrained
// to a same-origin path so this cannot be used as an open redirect.

import { draftMode } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getAdminAccess } from '../../_api/adminAccess'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const url = searchParams.get('url')
  const secret = searchParams.get('secret')

  const expectedSecret = process.env.NEXT_PRIVATE_DRAFT_SECRET

  const access = await getAdminAccess()
  if (!access.authorized) {
    draftMode().disable()
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  if (!expectedSecret || secret !== expectedSecret) {
    return new Response('Invalid token', { status: 401 })
  }

  // Same-origin, path-only redirects. A caller-supplied absolute URL would
  // make this an open redirect.
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return new Response('No valid URL provided', { status: 400 })
  }

  draftMode().enable()

  return NextResponse.redirect(new URL(url, request.nextUrl.origin))
}
