// src/app/api/admin/products/bulk/route.ts
//
// POST /api/admin/products/bulk — publish, unpublish or delete several
// products in one action.
//
// Admin only. Each id goes through the same `updateProduct`/`deleteProduct`
// mutation a single-record edit uses, so every validation rule applies
// unchanged; see `_shared/bulk.ts` for why this is a loop rather than an
// `updateMany`.
//
// Always responds 200 with a per-item report. A partial failure is a normal
// outcome here, not an HTTP error: nine successes and one failure is
// information the operator needs, and a 4xx/5xx would discard it.

import { NextResponse } from 'next/server'

import { deleteProduct, updateProduct } from '../../../../_api/adminMutations'
import { requireAdmin } from '../../../../_api/requireAdmin'
import { parseBulkRequest, runBulk } from '../../_shared/bulk'
import { adminErrorResponse, readJsonBody } from '../../_shared/respond'

export const dynamic = 'force-dynamic'

const ACTIONS = ['publish', 'unpublish', 'delete'] as const

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readJsonBody(request)
    const { action, ids } = parseBulkRequest(body, ACTIONS)

    const report = await runBulk(ids, async id => {
      if (action === 'delete') {
        await deleteProduct(id)
        return
      }

      await updateProduct(id, { status: action === 'publish' ? 'published' : 'draft' })
    })

    return NextResponse.json(report)
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
