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
//
// ---------------------------------------------------------------------
// PHASE 13S — return a `StorefrontPage` view model instead of `PayloadPage`
// ---------------------------------------------------------------------
//
// `toStorefrontPage` used to build a `PayloadPage` (`payload-types.ts`)
// directly, with `hero`/`layout` each forced into a Payload-generated
// field type via `as PayloadPage['hero']`/`as PayloadPage['layout']` — both
// casts existed only to satisfy the return type's annotation; neither field
// was actually validated or narrowed by them; `resolved.hero`/
// `resolved.layout` are `unknown`/`unknown[]` either way, straight from
// `layoutRelationsAdapter.ts`.
//
// This function now returns `StorefrontPage` (`src/app/_types/storefront.ts`)
// instead — a dedicated, non-Payload view model whose `hero`/`layout`
// fields are typed against the Phase 13Q dispatcher view models
// (`StorefrontHero`/`StorefrontLayoutBlock`, the same types `Hero`/`Blocks`
// themselves already accept), so the casts below are to that file's own
// types rather than `payload-types.ts`'s. This drops the
// `Page as PayloadPage` import from this file entirely.
//
// The caller (`fetchPageNative.ts`'s `buildStorefrontPage`) is responsible
// for the one remaining conversion back to `payload-types.ts`'s `Page` —
// still needed today because `src/app/(pages)/[slug]/page.tsx` declares its
// `page` variable against the full generated type — see that file's own
// PHASE 13S comment.

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
