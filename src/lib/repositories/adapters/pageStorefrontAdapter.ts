// src/lib/repositories/adapters/pageStorefrontAdapter.ts
//
// Maps a native domain `Page` (plus its already-resolved hero and layout
// relations) onto the `StorefrontPage` view model the CMS page route and
// the `Blocks`/`Hero` dispatchers render.
//
// Pure function, no I/O — `hero`/`layout`/`metaImage` are already
// relation-resolved by the caller (see fetchPage.ts and
// layoutRelationsAdapter.ts).

import type { StorefrontPage } from '../../../app/_types/storefront'
import type { Media as NativeMedia, Page as NativePage } from '../../domain/types'
import { toStorefrontMedia } from './mediaStorefrontAdapter'

export interface ResolvedPageRelations {
  /** Already relation-resolved via `resolveStorefrontHero` — see
   * layoutRelationsAdapter.ts. `null` maps to the same "no hero" shape
   * `Hero`/`generateStaticParams` already treat as `type: 'none'`. */
  hero: unknown
  /** Already relation-resolved via `resolveStorefrontLayout` — see
   * layoutRelationsAdapter.ts. */
  layout: unknown[]
  metaImage: NativeMedia | null
}

export const toStorefrontPage = (
  page: NativePage,
  resolved: ResolvedPageRelations,
): StorefrontPage => {
  const result: StorefrontPage = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    _status: page.status,

    hero: (resolved.hero ?? {
      type: 'none',
      richText: [],
      media: undefined,
    }) as StorefrontPage['hero'],

    layout: resolved.layout as StorefrontPage['layout'],

    meta: {
      title: page.meta.title,
      description: page.meta.description,
      image: resolved.metaImage ? toStorefrontMedia(resolved.metaImage) : undefined,
    },

    updatedAt: page.updatedAt.toISOString(),
    createdAt: page.createdAt.toISOString(),
  }

  return result
}
