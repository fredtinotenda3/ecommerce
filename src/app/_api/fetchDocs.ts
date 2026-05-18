// src/app/_api/fetchDocs.ts
import type { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies'

import type { Config } from '../../payload/payload-types'
import { CATEGORIES } from '../_graphql/categories'
import { ORDERS } from '../_graphql/orders'
import { PAGES } from '../_graphql/pages'
import { PRODUCTS } from '../_graphql/products'
import { GRAPHQL_API_URL } from './shared'
import { payloadToken } from './token'

const queryMap = {
  pages: {
    query: PAGES,
    key: 'Pages',
  },
  products: {
    query: PRODUCTS,
    key: 'Products',
  },
  orders: {
    query: ORDERS,
    key: 'Orders',
  },
  categories: {
    query: CATEGORIES,
    key: 'Categories',
  },
}

export const fetchDocs = async <T>(
  collection: keyof Config['collections'],
  draft?: boolean,
): Promise<T[]> => {
  if (!queryMap[collection]) throw new Error(`Collection ${collection} not found`)

  let token: RequestCookie | undefined

  if (draft) {
    const { cookies } = await import('next/headers')
    token = cookies().get(payloadToken)
  }

  const response = await fetch(`${GRAPHQL_API_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token?.value && draft ? { Authorization: `JWT ${token.value}` } : {}),
    },
    cache: 'no-store',
    next: { tags: [collection] },
    body: JSON.stringify({
      query: queryMap[collection].query,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${collection}: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new Error(
      `Expected JSON response for ${collection} but got ${contentType ?? 'unknown content type'}`,
    )
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Error fetching ${collection}`)
  }

  const docs: T[] = json?.data?.[queryMap[collection].key]?.docs

  return Array.isArray(docs) ? docs : []
}
