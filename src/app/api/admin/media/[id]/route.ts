// src/app/api/admin/media/[id]/route.ts
//
// PATCH — edit a media record's alt text and caption.
// DELETE — remove the record and its file, refused while anything still
// references it.
//
// The stored file itself is immutable: replacing an image means uploading
// a new one, so nothing that already points at this record silently
// changes underneath it.
//
// Admin only.

import { NextResponse } from 'next/server'

import { deleteMedia, updateMedia } from '../../../../_api/adminMutations'
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
    const media = await updateMedia(params.id, await readJsonBody(request))
    return NextResponse.json({ media })
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
    await deleteMedia(params.id)
    return NextResponse.json({ deleted: true })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
