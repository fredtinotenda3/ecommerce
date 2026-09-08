// src/app/sitemap.ts
//
// Serves /sitemap.xml: the published pages and the published products.
//
// Reads through the same repository layer the storefront uses, so a draft
// can never be listed — `fetchPageSlugs` and `fetchProductSlugs` both filter
// on published status.
//
// A failed database read degrades to the static routes rather than to a
// 500. An incomplete sitemap costs some crawl efficiency; a sitemap that
// errors makes a search engine back off the whole site.

import type { MetadataRoute } from 'next'

import { fetchPageSlugs } from './_api/fetchPage'
import { fetchProductSlugs } from './_api/fetchProduct'

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** Pages that exist as routes rather than as CMS documents, plus the ones
 * that must never appear (cart is per-visitor; login/checkout are dead ends
 * for a searcher). */
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/products', priority: 0.9, changeFrequency: 'daily' },
]

const EXCLUDED_PAGE_SLUGS = new Set(['home', 'cart', 'checkout', 'login', 'logout'])

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map(route => ({
    url: `${serverUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))

  try {
    const [pages, products] = await Promise.all([fetchPageSlugs(), fetchProductSlugs()])

    pages
      .filter(slug => Boolean(slug) && !EXCLUDED_PAGE_SLUGS.has(slug))
      .forEach(slug => {
        entries.push({
          url: `${serverUrl}/${slug}`,
          lastModified: now,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      })

    products.forEach(slug => {
      entries.push({
        url: `${serverUrl}/products/${slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      })
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('sitemap read failed; serving static routes only:', error)
  }

  return entries
}
