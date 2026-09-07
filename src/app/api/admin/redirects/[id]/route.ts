// src/app/api/admin/redirects/[id]/route.ts
//
// PATCH — edit a redirect. DELETE — remove it. Admin only.

import { NextResponse } from 'next/server'

import { deleteRedirect, updateRedirect } from '../../../../_api/adminMutations'
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
    const redirect = await updateRedirect(params.id, await readJsonBody(request))
    return NextResponse.json({ redirect })
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
    await deleteRedirect(params.id)
    return NextResponse.json({ deleted: true })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
