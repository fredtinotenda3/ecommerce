// src/app/api/admin/categories/bulk/route.ts
//
// POST /api/admin/categories/bulk — delete several categories at once.
//
// Admin only, and delete-only: a category is a title and an image, so
// there is no meaningful bulk edit.
//
// `deleteCategory` refuses a category that still has products in it. That
// rule is enforced there, once, and this route inherits it — a category
// still in use reports its own failure while the rest of the batch
// succeeds, which is exactly the outcome an operator clearing out unused
// categories wants.

import { NextResponse } from 'next/server'

import { deleteCategory } from '../../../../_api/adminMutations'
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
      await deleteCategory(id)
    })

    return NextResponse.json(report)
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
