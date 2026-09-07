// src/app/api/admin/pages/route.ts
//
// POST — create a CMS page. Admin only.

import { NextResponse } from 'next/server'

import { createPage } from '../../../_api/adminMutations'
import { requireAdmin } from '../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../_shared/respond'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const page = await createPage(await readJsonBody(request))
    return NextResponse.json({ page }, { status: 201 })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
