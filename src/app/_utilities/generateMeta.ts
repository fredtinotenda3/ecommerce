// src/app/_utilities/generateMeta.ts
//
// Builds Next.js metadata for a page or product. Reads only the handful of
// SEO fields modelled by `StorefrontMetaDoc`.

import type { Metadata } from 'next'

import type { StorefrontMetaDoc } from '../_types/storefront'
import { mergeOpenGraph } from './mergeOpenGraph'

export const generateMeta = async (args: { doc: StorefrontMetaDoc }): Promise<Metadata> => {
  const { doc } = args || {}

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
    title: doc?.meta?.title || 'Store',
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      title: doc?.meta?.title || 'Store',
      description: doc?.meta?.description,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
    }),
  }
}
