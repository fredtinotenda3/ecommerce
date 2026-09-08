// src/app/_utilities/mergeOpenGraph.ts
//
// The Open Graph defaults every page starts from. Brand facts come from
// `constants/brand.ts` so the social card, the page title and the footer
// cannot disagree about what the shop is called.

import type { Metadata } from 'next'

import { SITE_DESCRIPTION, SITE_NAME, SITE_OG_IMAGE, SITE_TAGLINE } from '../constants/brand'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  locale: 'en_ZW',
  siteName: SITE_NAME,
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  images: [
    {
      url: SITE_OG_IMAGE,
      width: 1200,
      height: 630,
      alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
    },
  ],
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
