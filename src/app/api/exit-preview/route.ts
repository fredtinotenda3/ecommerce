// src/app/api/exit-preview/route.ts
//
// GET /api/exit-preview?url=<path> — leaves draft mode.
//
// No authorization: this only ever removes access to draft content, so the
// worst an anonymous caller can do is turn off their own preview. The
// redirect target is constrained to a same-origin path for the same reason
// as /api/preview.

import { draftMode } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  draftMode().disable()

  const url = request.nextUrl.searchParams.get('url')

  if (url && url.startsWith('/') && !url.startsWith('//')) {
    return NextResponse.redirect(new URL(url, request.nextUrl.origin))
  }

  return new NextResponse('Draft mode is disabled')
}
