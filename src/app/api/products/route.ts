// src/app/api/products/route.ts
//
// GET /api/products — the paginated, published product listing behind the
// storefront's `CollectionArchive` grid.
//
// Query parameters:
//   category  repeated, or comma-separated — union filter. Accepts either a
//             24-hex category id (what the filter checkboxes submit) or a
//             human-readable slug derived from the category title (what the
//             navigation links use). See `_utilities/categorySlug.ts`.
//   q         free-text search over title and meta description
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
import { fetchCategories } from '../../_api/fetchCategories'
import { fetchProducts } from '../../_api/fetchProduct'
import { isCategoryId, resolveCategoryTokens } from '../../_utilities/categorySlug'

const VALID_SORTS: ProductSort[] = ['newest', 'oldest', 'price-asc', 'price-desc', 'title']

/** Long enough for a product name, short enough that the term cannot be
 * used to push an expensive pattern at the database. */
const MAX_SEARCH_LENGTH = 80

const parsePositiveInt = (value: string | null, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/** Accepts both `?category=a&category=b` and `?category=a,b`: the first is
 * what a form produces, the second is easier to hand-write. */
const parseCategoryTokens = (params: URLSearchParams): string[] =>
  params
    .getAll('category')
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)

const parseSearch = (value: string | null): string | undefined => {
  const trimmed = (value || '').trim()
  return trimmed ? trimmed.slice(0, MAX_SEARCH_LENGTH) : undefined
}

const parseSort = (value: string | null): ProductSort | undefined =>
  VALID_SORTS.includes(value as ProductSort) ? (value as ProductSort) : undefined

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams

  try {
    const tokens = parseCategoryTokens(params)

    // Only pay for the category listing when at least one token is a slug;
    // the common case (checkbox filters) submits ids and needs no lookup.
    const categoryIds = tokens.every(isCategoryId)
      ? tokens
      : resolveCategoryTokens(tokens, await fetchCategories())

    // A filter that was asked for but resolved to nothing must return an
    // empty page rather than the unfiltered catalogue — otherwise a typo in
    // the URL silently shows every product as if it had matched.
    if (tokens.length > 0 && categoryIds.length === 0) {
      const limit = Math.min(Math.max(parsePositiveInt(params.get('limit'), 10), 1), 100)
      return NextResponse.json({
        docs: [],
        page: 1,
        limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      })
    }

    const result = await fetchProducts({
      categoryIds,
      search: parseSearch(params.get('q')),
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
