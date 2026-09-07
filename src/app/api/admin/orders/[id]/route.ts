// src/app/api/admin/orders/[id]/route.ts
//
// PATCH — move an order along its lifecycle, and/or record a payment
// status the provider callback cannot express (a refund made in Paynow's
// dashboard, say).
//
// Both go through the state machine, so an invalid jump is rejected rather
// than written. Marking an order PAID additionally requires a confirmed
// payment to exist — see AdminContentService.
//
// Admin only.

import { NextResponse } from 'next/server'

import { updateOrderStatus, updatePaymentStatus } from '../../../../_api/adminMutations'
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
    const body = await readJsonBody(request)

    const payment =
      typeof body.paymentId === 'string' && body.paymentStatus !== undefined
        ? await updatePaymentStatus(body.paymentId, body.paymentStatus)
        : null

    const order = body.status !== undefined ? await updateOrderStatus(params.id, body.status) : null

    if (!order && !payment) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    return NextResponse.json({ order, payment })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
