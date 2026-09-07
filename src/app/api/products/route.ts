// src/app/api/products/route.ts
//
// GET /api/products — the paginated, published product listing behind the
// storefront's `CollectionArchive` grid.
//
// Query parameters:
//   category  repeated, or comma-separated — union filter across categories
//   page      1-based, clamped to the last page of the current result set
//   limit     1-100, default 10
//   sort      newest | oldest | price-asc | price-desc | title
//
// Public and read-only: no session is required and nothing here is
// writable. Only published products are returned, and only the fields a
// product card renders — never a layout, paywall block or draft.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import type { ProductSort } from '../../../lib/domain/types'
import { fetchProducts } from '../../_api/fetchProduct'

const VALID_SORTS: ProductSort[] = ['newest', 'oldest', 'price-asc', 'price-desc', 'title']

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Accepts both `?category=a&category=b` and `?category=a,b`: the first is
 * what a form produces, the second is easier to hand-write. Anything that
 * is not a plausible id is dropped rather than passed to the database. */
const parseCategories = (params: URLSearchParams): string[] =>
  params
    .getAll('category')
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(value => /^[a-f\d]{24}$/i.test(value))

const parseSort = (value: string | null): ProductSort | undefined =>
  VALID_SORTS.includes(value as ProductSort) ? (value as ProductSort) : undefined

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams

  try {
    const result = await fetchProducts({
      categoryIds: parseCategories(params),
      limit: parsePositiveInt(params.get('limit'), 10),
      page: parsePositiveInt(params.get('page'), 1),
      sort: parseSort(params.get('sort')),
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('product listing failed:', error)
    return NextResponse.json({ error: 'Unable to load products.' }, { status: 500 })
  }
}
