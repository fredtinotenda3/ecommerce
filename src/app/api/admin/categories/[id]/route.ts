// src/app/api/admin/categories/[id]/route.ts
//
// PATCH — edit a category (title, media, parent).
// DELETE — remove it, refused while products or child categories still
// reference it.
//
// Admin only.

import { NextResponse } from 'next/server'

import { deleteCategory, updateCategory } from '../../../../_api/adminMutations'
import { requireAdmin } from '../../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../../_shared/respond'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const category = await updateCategory(params.id, await readJsonBody(request))
    return NextResponse.json({ category })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    await deleteCategory(params.id)
    return NextResponse.json({ deleted: true })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
