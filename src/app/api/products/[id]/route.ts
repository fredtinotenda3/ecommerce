// src/app/api/products/[id]/route.ts
//
// GET /api/products/:id — a single published product as a card.
//
// Used when the cart rehydrates from local storage, where only product ids
// were stored. Public and read-only; an unpublished or unknown id is a 404.

import { NextResponse } from 'next/server'

import { fetchProductCardById } from '../../../_api/fetchProduct'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const product = await fetchProductCardById(params.id)
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json(product)
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('product fetch failed:', error)
    return NextResponse.json({ error: 'Unable to load product.' }, { status: 500 })
  }
}
