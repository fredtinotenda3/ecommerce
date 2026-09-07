// src/app/api/preview/route.ts
//
// GET /api/preview?url=<path>&secret=<optional> — enables Next.js draft
// mode so unpublished content can be viewed before it is published.
//
// Authorization: an admin session is always required. That is the primary
// control, and it is checked before anything else so an anonymous caller
// cannot use this endpoint to probe whether a secret is configured.
//
// `NEXT_PRIVATE_DRAFT_SECRET` is an optional second factor: when it is
// set, the link must also carry it, which is what makes a preview URL safe
// to paste to someone who is already an admin but is opening it in another
// browser. When it is not set, an admin session alone is sufficient —
// rather than the endpoint silently refusing every request, which is how
// preview came to look broken.
//
// The redirect target is constrained to a same-origin path, so this cannot
// be turned into an open redirect.

import { draftMode } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getAdminAccess } from '../../_api/adminAccess'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl
  const url = searchParams.get('url')
  const secret = searchParams.get('secret')

  const access = await getAdminAccess()
  if (!access.authorized) {
    draftMode().disable()
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  const expectedSecret = process.env.NEXT_PRIVATE_DRAFT_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return new Response('Invalid preview token', { status: 401 })
  }

  // Same-origin, path-only redirects. A caller-supplied absolute URL would
  // make this an open redirect.
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return new Response('No valid URL provided', { status: 400 })
  }

  draftMode().enable()

  return NextResponse.redirect(new URL(url, request.nextUrl.origin))
}
