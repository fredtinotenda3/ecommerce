// src/lib/repositories/adapters/categoryStorefrontAdapter.ts
//
// Maps a native domain `Category` (plus its already-resolved media record)
// onto the storefront's category view model — exactly the fields `Filters`,
// `Categories` and `CategoryCard` read.
//
// Pure function, no I/O: media resolution happens in the caller.

import type { StorefrontCategory } from '../../../app/_types/storefront'
import type { Category as NativeCategory, Media as NativeMedia } from '../../domain/types'
import { toStorefrontMedia } from './mediaStorefrontAdapter'

/** `media` is the already-resolved record for `category.mediaId`, or `null`
 * when the category has no media (or the record could not be found). */
export const toStorefrontCategory = (
  category: NativeCategory,
  media: NativeMedia | null,
): StorefrontCategory => ({
  id: category.id,
  title: category.title,
  media: media ? toStorefrontMedia(media) : undefined,
})
