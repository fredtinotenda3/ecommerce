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
}): Promise<T | null> => {
  const { collection, slug, draft, id } = args || {}

  if (!queryMap[collection]) throw new Error(`Collection ${collection} not found`)

  let token: RequestCookie | undefined

  if (draft) {
    try {
      const { cookies } = await import('next/headers')
      token = cookies().get(payloadToken)
    } catch (e: unknown) {
      // Cookies not available in this context
    }
  }

  try {
    const url = id ? `${GRAPHQL_API_URL}/api/${collection}/${id}` : `${GRAPHQL_API_URL}/api/graphql`

    const res = await fetch(url, {
      method: id ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token?.value && draft ? { Authorization: `JWT ${token.value}` } : {}),
      },
      cache: 'no-store',
      next: { tags: [`${collection}_${slug || id}`] },
      ...(id
        ? {}
        : {
            body: JSON.stringify({
              query: queryMap[collection].query,
              variables: {
                slug,
                draft,
              },
            }),
          }),
    })

    const contentType = res.headers.get('content-type')

    if (!res.ok) {
      console.error(`Fetch failed for ${collection} slug: ${slug || id}. Status: ${res.status}`)
      return null
    }

    if (!contentType?.includes('application/json')) {
      console.error(`Invalid content type for ${collection} slug: ${slug || id}`)
      return null
    }

    const json = await res.json()

    if (json.errors) {
      console.error(`GraphQL Error: ${json.errors[0]?.message}`)
      return null
    }

    if (id) {
      return json
    }

    return json?.data?.[queryMap[collection].key]?.docs?.[0] || null
  } catch (error: unknown) {
    console.error(`Error in fetchDoc:`, error)
    return null
  }
}
