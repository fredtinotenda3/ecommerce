// src/app/api/products/route.ts
//
// GET /api/products — the paginated, published product listing behind the
// storefront's `CollectionArchive` grid.
//
// Public and read-only: no session is required and nothing here is
// writable. Only published products are returned, and only the fields a
// product card renders — never a layout, paywall block or draft.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { fetchProducts } from '../../_api/fetchProduct'

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams

  try {
    const result = await fetchProducts({
      categoryId: params.get('category') ?? undefined,
      limit: parsePositiveInt(params.get('limit'), 10),
      page: parsePositiveInt(params.get('page'), 1),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('product listing failed:', error)
    return NextResponse.json({ error: 'Unable to load products.' }, { status: 500 })
  }
}
