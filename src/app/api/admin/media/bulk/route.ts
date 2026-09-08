// src/app/api/admin/media/bulk/route.ts
//
// POST /api/admin/media/bulk — delete several media records at once.
//
// Admin only. Delete is the only bulk action offered: alt text is
// per-image by definition, so there is nothing else worth doing to a
// selection.
//
// Each id goes through `deleteMedia`, which removes the stored file as
// well as the record. Deleting media that a product still references is
// permitted and leaves that product without an image — the same behaviour
// as the single-record delete, and refusing it here while allowing it
// there would be the inconsistency, not the safeguard.

import { NextResponse } from 'next/server'

import { deleteMedia } from '../../../../_api/adminMutations'
import { requireAdmin } from '../../../../_api/requireAdmin'
import { parseBulkRequest, runBulk } from '../../_shared/bulk'
import { adminErrorResponse, readJsonBody } from '../../_shared/respond'

export const dynamic = 'force-dynamic'

const ACTIONS = ['delete'] as const

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readJsonBody(request)
    const { ids } = parseBulkRequest(body, ACTIONS)

    const report = await runBulk(ids, async id => {
      await deleteMedia(id)
    })

    return NextResponse.json(report)
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
