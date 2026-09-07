// src/app/api/admin/products/[id]/route.ts
//
// PATCH — edit a product (title, slug, status, categories, layout, SEO).
// DELETE — remove it.
//
// Admin only.

import { NextResponse } from 'next/server'

import { deleteProduct, updateProduct } from '../../../../_api/adminMutations'
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
    const product = await updateProduct(params.id, body)
    return NextResponse.json({ product })
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
    await deleteProduct(params.id)
    return NextResponse.json({ deleted: true })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
