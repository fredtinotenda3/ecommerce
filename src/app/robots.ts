// src/app/robots.ts
//
// Serves /robots.txt.
//
// Crawling is only allowed when NEXT_PUBLIC_IS_LIVE is set. Staging and
// preview deployments must not be indexed, and relying on the operator to
// remember that is how duplicate storefronts end up in search results —
// `next.config.js` sets an `X-Robots-Tag: noindex` header under the same
// condition, so the two agree.
//
// The disallow list covers everything that is either private (the admin and
// the account area), a side effect (checkout, logout), or has no standalone
// value to a searcher (the API and the preview entry points). None of these
// are access control: authorisation is enforced server-side, and this only
// keeps well-behaved crawlers out of pages that would waste their budget.

import type { MetadataRoute } from 'next'

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

const PRIVATE_PATHS = [
  '/admin',
  '/admin/',
  '/api/',
  '/account',
  '/orders',
  '/checkout',
  '/cart',
  '/logout',
  '/next/preview',
  '/next/exit-preview',
]

export default function robots(): MetadataRoute.Robots {
  const isLive = Boolean(process.env.NEXT_PUBLIC_IS_LIVE)

  if (!isLive) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${serverUrl}/sitemap.xml`,
    host: serverUrl,
  }
}
