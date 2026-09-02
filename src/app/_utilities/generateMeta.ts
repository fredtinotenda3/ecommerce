import type { Metadata } from 'next'

import type { StorefrontMetaDoc } from '../_types/storefront'
import { mergeOpenGraph } from './mergeOpenGraph'

// PHASE 13G: narrowed from the full `payload-types.ts` `Page | Product`
// — this function only ever reads `.slug` and a few `.meta` fields
// (including `.meta.image`, read only for its `.url`, same as
// `StorefrontMediaRef` — never `.sizes`). See StorefrontMetaDoc's doc
// comment in src/app/_types/storefront.ts. Every real `Page`/`Product`,
// and the `staticHome`/`staticCart` seed fallbacks, satisfy this
// unchanged — none of `generateMeta`'s three call sites needed to
// change.
export const generateMeta = async (args: { doc: StorefrontMetaDoc }): Promise<Metadata> => {
  const { doc } = args || {}

  const ogImage =
    typeof doc?.meta?.image === 'object' &&
    doc?.meta?.image !== null &&
    'url' in doc?.meta?.image &&
    `${process.env.NEXT_PUBLIC_SERVER_URL}${doc.meta.image.url}`

  return {
    title: doc?.meta?.title || 'Payload',
    description: doc?.meta?.description,
    openGraph: mergeOpenGraph({
      title: doc?.meta?.title || 'Payload',
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
