// src/app/api/admin/categories/route.ts
//
// POST — create a category. Admin only.

import { NextResponse } from 'next/server'

import { createCategory } from '../../../_api/adminMutations'
import { requireAdmin } from '../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../_shared/respond'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const category = await createCategory(await readJsonBody(request))
    return NextResponse.json({ category }, { status: 201 })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
