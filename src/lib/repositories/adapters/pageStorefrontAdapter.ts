// src/lib/repositories/adapters/pageStorefrontAdapter.ts
//
// Phase 3: maps a native domain `Page` (plus its already-resolved hero
// and layout relations) onto the exact shape the storefront's CMS Page
// route and `Blocks` renderer already expect from `payload-types.ts`'s
// `Page` — mirrors the `PAGE` GraphQL query field-for-field (see
// src/app/_graphql/pages.ts): id, title, hero, layout, meta.
//
// Pure function, no I/O — `hero`/`layout`/`metaImage` are already
// relation-resolved by the caller (see fetchPageNative.ts and
// layoutRelationsAdapter.ts), same division of responsibility as
// `categoryStorefrontAdapter.ts`/`productStorefrontAdapter.ts`.

import type { Page as PayloadPage } from '../../../payload/payload-types'
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
): PayloadPage => {
  const result: PayloadPage = {
    id: page.id,
    title: page.title,
    slug: page.slug,
    _status: page.status,

    hero: (resolved.hero ?? {
      type: 'none',
      richText: [],
      media: undefined,
    }) as PayloadPage['hero'],

    layout: resolved.layout as PayloadPage['layout'],

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
