// src/app/api/admin/orders/bulk/route.ts
//
// POST /api/admin/orders/bulk — move several orders to the same status.
//
// Admin only. There is deliberately no bulk delete: an order is a
// financial record, and the way to end one is a status transition that
// leaves an auditable trail.
//
// The legal transitions live in `ORDER_STATUS_TRANSITIONS` and are enforced
// by `updateOrderStatus`, not here. An order that cannot legally reach the
// requested status reports that as its own failure and the rest of the
// batch proceeds — which is what makes "mark these six as shipped" safe to
// run over a mixed selection.

import { NextResponse } from 'next/server'

import { updateOrderStatus } from '../../../../_api/adminMutations'
import { requireAdmin } from '../../../../_api/requireAdmin'
import { parseBulkRequest, runBulk } from '../../_shared/bulk'
import { adminErrorResponse, readJsonBody } from '../../_shared/respond'

export const dynamic = 'force-dynamic'

/** The statuses an operator moves orders into by hand, as named in
 * `OrderStatus`. `PENDING_PAYMENT` and `PAID` are absent on purpose: those
 * are set by the Paynow callback, which is the only authoritative source of
 * a payment outcome, and offering them here would let an operator mark an
 * unpaid order as paid from a table. */
const ACTIONS = ['PROCESSING', 'FULFILLED', 'CANCELLED', 'REFUNDED'] as const

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readJsonBody(request)
    const { action, ids } = parseBulkRequest(body, ACTIONS)

    const report = await runBulk(ids, async id => {
      await updateOrderStatus(id, action)
    })

    return NextResponse.json(report)
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
