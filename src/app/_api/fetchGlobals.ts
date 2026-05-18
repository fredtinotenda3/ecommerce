import type { Footer, Header, Settings } from '../../payload/payload-types'
import { FOOTER_QUERY, HEADER_QUERY, SETTINGS_QUERY } from '../_graphql/globals'
import { GRAPHQL_API_URL } from './shared'

async function safeFetch(query: string): Promise<any> {
  if (!GRAPHQL_API_URL) {
    throw new Error('NEXT_PUBLIC_SERVER_URL is not defined')
  }

  const response = await fetch(`${GRAPHQL_API_URL}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON but got ${contentType} — is NEXT_PUBLIC_SERVER_URL correct?`)
  }

  const json = await response.json()
  if (json?.errors) throw new Error(json.errors[0]?.message ?? 'GraphQL error')
  return json
}

export async function fetchSettings(): Promise<Settings> {
  const json = await safeFetch(SETTINGS_QUERY)
  return json.data?.Settings
}

export async function fetchHeader(): Promise<Header> {
  const json = await safeFetch(HEADER_QUERY)
  return json.data?.Header
}

export async function fetchFooter(): Promise<Footer> {
  const json = await safeFetch(FOOTER_QUERY)
  return json.data?.Footer
}

export const fetchGlobals = async (): Promise<{
  settings: Settings
  header: Header
  footer: Footer
}> => {
  const [settings, header, footer] = await Promise.all([
    fetchSettings(),
    fetchHeader(),
    fetchFooter(),
  ])
  return { settings, header, footer }
}
