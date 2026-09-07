// src/app/api/admin/products/[id]/price/route.ts
//
// PATCH — set a product's authoritative price.
//
// Its own endpoint because pricing is the one product field that decides
// what a customer is charged: a separate route keeps it out of general
// edits and makes price changes individually auditable in access logs.
//
// Amounts are integers in the currency's minor units. Admin only.

import { NextResponse } from 'next/server'

import { setProductPrice } from '../../../../../_api/adminMutations'
import { requireAdmin } from '../../../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../../../_shared/respond'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readJsonBody(request)
    const product = await setProductPrice(params.id, body)
    return NextResponse.json({ product })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
