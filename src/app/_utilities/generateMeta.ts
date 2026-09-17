// src/app/_utilities/generateMeta.ts
//
// Builds Next.js metadata for a page or product. Reads only the handful of
// SEO fields modelled by `StorefrontMetaDoc`.

import type { Metadata } from 'next'

import { DEFAULT_SITE_NAME, DEFAULT_SITE_TAGLINE } from '../../lib/domain/siteDefaults'
import type { StorefrontMetaDoc } from '../_types/storefront'
import { mergeOpenGraph, type OpenGraphSiteInfo } from './mergeOpenGraph'

export const generateMeta = async (args: {
  doc: StorefrontMetaDoc
  siteInfo?: OpenGraphSiteInfo
}): Promise<Metadata> => {
  const { doc, siteInfo } = args || {}

  // Used when a document carries no meta title of its own. Never the bare
  // site name on its own — a browser tab reading only "Terro Technology"
  // tells a customer with six tabs open nothing.
  const fallbackTitle = `${siteInfo?.siteName || DEFAULT_SITE_NAME} — ${
    siteInfo?.siteTagline || DEFAULT_SITE_TAGLINE
  }`

  const metaImage = doc?.meta?.image
  const imageUrl = typeof metaImage === 'object' && metaImage !== null ? metaImage.url : null

  // Open Graph requires an absolute URL. Stored media urls are
  // root-relative (`/media/…`), so they are prefixed with the public
  // origin — but a url that is already absolute is left alone rather than
  // concatenated into nonsense.
  const ogImage = imageUrl
    ? /^https?:\/\//.test(imageUrl)
      ? imageUrl
      : `${process.env.NEXT_PUBLIC_SERVER_URL ?? ''}${imageUrl}`
    : undefined

  return {
    title: doc?.meta?.title || fallbackTitle,
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph(
      {
        title: doc?.meta?.title || fallbackTitle,
        description: doc?.meta?.description,
        url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
        images: ogImage
          ? [
              {
                url: ogImage,
              },
            ]
          : undefined,
      },
      siteInfo,
    ),
  }
}
