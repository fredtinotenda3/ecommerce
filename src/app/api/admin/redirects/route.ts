// src/app/api/admin/redirects/route.ts
//
// POST — create a redirect. Admin only.

import { NextResponse } from 'next/server'

import { createRedirect } from '../../../_api/adminMutations'
import { requireAdmin } from '../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../_shared/respond'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const redirect = await createRedirect(await readJsonBody(request))
    return NextResponse.json({ redirect }, { status: 201 })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
