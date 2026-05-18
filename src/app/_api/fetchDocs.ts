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

  // Re-read at call time so build-time worker processes see INTERNAL_SERVER_URL
  const apiUrl =
    process.env.INTERNAL_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || GRAPHQL_API_URL

  const response = await fetch(`${apiUrl}/api/graphql`, {
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
    throw new Error(
      `fetchDocs "${collection}": HTTP ${response.status} ${response.statusText} — URL: ${apiUrl}`,
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      `fetchDocs "${collection}": expected JSON but got "${contentType}" from ${apiUrl}. ` +
        `INTERNAL_SERVER_URL=${process.env.INTERNAL_SERVER_URL} ` +
        `NEXT_PUBLIC_SERVER_URL=${process.env.NEXT_PUBLIC_SERVER_URL}`,
    )
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `GraphQL error fetching "${collection}"`)
  }

  const docs: T[] = json?.data?.[queryMap[collection].key]?.docs
  return Array.isArray(docs) ? docs : []
}
