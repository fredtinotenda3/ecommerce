// src/app/api/admin/pages/[id]/route.ts
//
// PATCH — edit a page (title, slug, status, hero, layout, SEO).
// DELETE — remove it, refused while Settings points at it.
//
// Admin only.

import { NextResponse } from 'next/server'

import { deletePage, updatePage } from '../../../../_api/adminMutations'
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
    const page = await updatePage(params.id, await readJsonBody(request))
    return NextResponse.json({ page })
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
    await deletePage(params.id)
    return NextResponse.json({ deleted: true })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
