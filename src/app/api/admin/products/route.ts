// src/app/api/admin/products/route.ts
//
// POST /api/admin/products — create a product.
//
// Admin only. New products are created as drafts unless a status is given,
// and always without a price: pricing goes through
// PATCH /api/admin/products/:id/price so it is never an accidental side
// effect of another edit.

import { NextResponse } from 'next/server'

import { createProduct } from '../../../_api/adminMutations'
import { requireAdmin } from '../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../_shared/respond'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readJsonBody(request)
    const product = await createProduct(body)
    return NextResponse.json({ product }, { status: 201 })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
