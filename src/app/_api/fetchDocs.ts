import type { Config } from '../../payload/payload-types'
import { CATEGORIES } from '../_graphql/categories'
import { PAGES } from '../_graphql/pages'
import { PRODUCTS } from '../_graphql/products'
import { GRAPHQL_API_URL } from './shared'

const queryMap = {
  pages: {
    query: PAGES,
    key: 'Pages',
  },
  products: {
    query: PRODUCTS,
    key: 'Products',
  },
  categories: {
    query: CATEGORIES,
    key: 'Categories',
  },
}

export const fetchDocs = async <T>(collection: keyof Config['collections']): Promise<T[]> => {
  if (!queryMap[collection]) throw new Error(`Collection ${collection} not found`)

  try {
    const res = await fetch(`${GRAPHQL_API_URL}/api/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({
        query: queryMap[collection].query,
      }),
    })

    const contentType = res.headers.get('content-type')

    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      console.error(`FetchDocs failed for ${collection}. Status: ${res.status}`)
      return []
    }

    const json = await res.json()

    if (json.errors) {
      console.error(json.errors)
      return []
    }

    return json?.data?.[queryMap[collection].key]?.docs || []
  } catch (error: unknown) {
    console.error(error)
    return []
  }
}
