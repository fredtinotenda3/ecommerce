// src/app/_api/fetchGlobals.ts
import type { Footer, Header, Settings } from '../../payload/payload-types'
import { FOOTER_QUERY, HEADER_QUERY, SETTINGS_QUERY } from '../_graphql/globals'
import { GRAPHQL_API_URL } from './shared'

async function graphqlFetch(query: string): Promise<Record<string, unknown>> {
  // Re-read at call time so build-time worker processes see INTERNAL_SERVER_URL
  const apiUrl =
    process.env.INTERNAL_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || GRAPHQL_API_URL

  const response = await fetch(`${apiUrl}/api/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    throw new Error(
      `GraphQL request failed: HTTP ${response.status} ${response.statusText} — URL: ${apiUrl}`,
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error(
      `fetchGlobals: expected JSON but got "${contentType}" from ${apiUrl}. ` +
        `INTERNAL_SERVER_URL=${process.env.INTERNAL_SERVER_URL} ` +
        `NEXT_PUBLIC_SERVER_URL=${process.env.NEXT_PUBLIC_SERVER_URL}`,
    )
  }

  const json = await response.json()
  if (json?.errors) throw new Error(json.errors[0]?.message ?? 'GraphQL error')
  return json
}

export async function fetchSettings(): Promise<Settings> {
  const json = await graphqlFetch(SETTINGS_QUERY)
  return (json.data as Record<string, Settings>)?.Settings
}

export async function fetchHeader(): Promise<Header> {
  const json = await graphqlFetch(HEADER_QUERY)
  return (json.data as Record<string, Header>)?.Header
}

export async function fetchFooter(): Promise<Footer> {
  const json = await graphqlFetch(FOOTER_QUERY)
  return (json.data as Record<string, Footer>)?.Footer
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
