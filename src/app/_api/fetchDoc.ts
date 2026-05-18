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

  const response = await fetch(`${GRAPHQL_API_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token?.value && draft ? { Authorization: `JWT ${token.value}` } : {}),
    },
    cache: 'no-store',
    next: { tags: [`${collection}_${slug}`] },
    body: JSON.stringify({
      query: queryMap[collection].query,
      variables: {
        slug,
        draft,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${collection}/${slug}: ${response.status} ${response.statusText}`,
    )
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new Error(
      `Expected JSON for ${collection}/${slug} but received ${
        contentType ?? 'unknown content type'
      }`,
    )
  }

  const json = await response.json()

  if (json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `Error fetching ${collection}/${slug}`)
  }

  const doc: T = json?.data?.[queryMap[collection].key]?.docs?.[0]

  return doc
}
