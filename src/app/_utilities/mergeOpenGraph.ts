// src/app/_utilities/mergeOpenGraph.ts
//
// The Open Graph defaults every page starts from.
//
// `siteInfo` carries the LIVE site identity (name/tagline/description/
// share image) once a caller has fetched Settings — see `layout.tsx` and
// `generateMeta.ts`, which are the two places that actually matter for
// SEO/sharing (the root layout's site-wide default, and every content/
// product page's per-document title). Every OTHER `mergeOpenGraph()` call
// site in this app (checkout, login, account, styleguide, …) calls it with
// no second argument and keeps working exactly as before: those pages
// don't override the site identity anyway, so they fall back to
// `siteDefaults.ts` — a deliberate, narrow scope, not an oversight (see the
// admin guide's "What's still a code-level default" section).
import type { Metadata } from 'next'

import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME, DEFAULT_SITE_TAGLINE } from '../../lib/domain/siteDefaults'

export interface OpenGraphSiteInfo {
  siteName?: string | null
  siteTagline?: string | null
  siteDescription?: string | null
  /** A root-relative or absolute url to use as the fallback share image. */
  shareImageUrl?: string | null
}

/** Builds the `OpenGraphSiteInfo` `mergeOpenGraph` callers want straight
 * from a fetched settings-shaped object (the raw domain `Settings`, or the
 * storefront `StorefrontSettingsLike` view model — both carry these same
 * three fields), so call sites don't each repeat the same field pick. */
export const siteInfoFromSettings = (
  settings: { siteName?: string | null; siteTagline?: string | null; siteDescription?: string | null } | null,
  shareImageUrl?: string | null,
): OpenGraphSiteInfo => ({
  siteName: settings?.siteName,
  siteTagline: settings?.siteTagline,
  siteDescription: settings?.siteDescription,
  shareImageUrl,
})

/** Open Graph requires an absolute URL. Stored media urls are root-relative
 * (`/media/…`), so they are prefixed with the public origin — but a url
 * that is already absolute is left alone rather than concatenated into
 * nonsense. Mirrors the identical rule `generateMeta.ts` applies to a
 * per-document meta image. */
const toAbsoluteUrl = (url: string): string =>
  /^https?:\/\//.test(url) ? url : `${process.env.NEXT_PUBLIC_SERVER_URL ?? ''}${url}`

export const mergeOpenGraph = (
  og?: Metadata['openGraph'],
  siteInfo?: OpenGraphSiteInfo,
): Metadata['openGraph'] => {
  const siteName = siteInfo?.siteName || DEFAULT_SITE_NAME
  const siteTagline = siteInfo?.siteTagline || DEFAULT_SITE_TAGLINE
  const siteDescription = siteInfo?.siteDescription || DEFAULT_SITE_DESCRIPTION

  const defaultOpenGraph: Metadata['openGraph'] = {
    type: 'website',
    locale: 'en_ZW',
    siteName,
    title: `${siteName} — ${siteTagline}`,
    description: siteDescription,
    images: siteInfo?.shareImageUrl
      ? [
          {
            url: toAbsoluteUrl(siteInfo.shareImageUrl),
            width: 1200,
            height: 630,
            alt: `${siteName} — ${siteTagline}`,
          },
        ]
      : undefined,
  }

  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
