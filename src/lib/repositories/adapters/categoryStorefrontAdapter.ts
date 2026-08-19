// src/lib/repositories/adapters/categoryStorefrontAdapter.ts
//
// Phase 2: maps native domain `Category`/`Media` records onto the exact
// shape the existing storefront components already expect from
// `payload-types.ts`'s `Category` (see src/app/_graphql/categories.ts for
// the GraphQL query this mirrors field-for-field: id, title, media { alt,
// width, height, url }).
//
// This is a deliberately narrow, storefront-read-only adapter — it is NOT a
// general Payload/native Category converter. It only populates the fields
// that `Filters` and `Categories`/`CategoryCard` actually read. It must not
// be used to satisfy Payload's admin UI or any write path.
//
// Pure function, no I/O — safe to unit test without a database.

import type {
  Category as PayloadCategory,
  Media as PayloadMedia,
} from '../../../payload/payload-types'
import type { Category as NativeCategory, Media as NativeMedia } from '../../domain/types'

const toPayloadMedia = (media: NativeMedia): PayloadMedia => ({
  id: media.id,
  alt: media.alt,
  url: media.url ?? undefined,
  filename: media.filename ?? undefined,
  mimeType: media.mimeType ?? undefined,
  filesize: media.filesize ?? undefined,
  width: media.width ?? undefined,
  height: media.height ?? undefined,
  updatedAt: media.updatedAt.toISOString(),
  createdAt: media.createdAt.toISOString(),
})

/** `media` is the already-resolved Media record for `category.mediaId`
 * (or `null` if the category has no media, or the media doc could not be
 * found). Resolution happens in the caller — this function stays pure. */
export const toStorefrontCategory = (
  category: NativeCategory,
  media: NativeMedia | null,
): PayloadCategory => ({
  id: category.id,
  title: category.title,
  media: media ? toPayloadMedia(media) : undefined,
  updatedAt: category.updatedAt.toISOString(),
  createdAt: category.createdAt.toISOString(),
})
