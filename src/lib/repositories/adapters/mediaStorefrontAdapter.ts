// src/lib/repositories/adapters/mediaStorefrontAdapter.ts
//
// Maps a native domain `Media` record onto the storefront's media view
// model. Pure function, no I/O.

import type { StorefrontMedia } from '../../../app/_types/storefront'
import type { Media as NativeMedia } from '../../domain/types'

export const toStorefrontMedia = (media: NativeMedia): StorefrontMedia => ({
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
