// src/app/_api/fetchDoc.ts
import type { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies'

import type { Config } from '../../payload/payload-types'
import { ORDER } from '../_graphql/orders'
import { PAGE } from '../_graphql/pages'
import { PRODUCT } from '../_graphql/products'
import { GRAPHQL_API_URL } from './shared'
import { payloadToken } from './token'

const queryMap = {
  pages: {
    query: PAGE,
    key: 'Pages',
  },
  products: {
    query: PRODUCT,
    key: 'Products',
  },
  orders: {
    query: ORDER,
    key: 'Orders',
  },
}

export const fetchDoc = async <T>(args: {
  collection: keyof Config['collections']
  slug?: string
  id?: string
  draft?: boolean
}): Promise<T> => {
  const { collection, slug, draft } = args || {}

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
    next: { tags: [`${collection}_${slug}`] },
    body: JSON.stringify({
      query: queryMap[collection].query,
      variables: { slug, draft },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `fetchDoc "${collection}/${slug}": HTTP ${response.status} ${response.statusText} — URL: ${apiUrl}`,
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      `fetchDoc "${collection}/${slug}": expected JSON but got "${contentType}" from ${apiUrl}. ` +
        `INTERNAL_SERVER_URL=${process.env.INTERNAL_SERVER_URL} ` +
        `NEXT_PUBLIC_SERVER_URL=${process.env.NEXT_PUBLIC_SERVER_URL}`,
    )
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `GraphQL error fetching "${collection}/${slug}"`)
  }

  return json?.data?.[queryMap[collection].key]?.docs?.[0]
}
