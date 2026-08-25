// src/lib/repositories/adapters/mediaStorefrontAdapter.ts
//
// PHASE 3 — small shared helper for mapping a native domain `Media` record
// onto the exact shape the storefront components expect from
// `payload-types.ts`'s `Media` (mirrors the `MEDIA_FIELDS`/`MEDIA` GraphQL
// fragments in src/app/_graphql/media.ts).
//
// Deliberately duplicated in spirit from (but not sharing code with)
// `categoryStorefrontAdapter.ts`'s private `toPayloadMedia` — that file
// already has passing Phase 2 tests and is left untouched; this is the one
// place Phase 3's Product/Page/layout adapters share the mapping from.
//
// Pure function, no I/O — safe to unit test without a database.

import type { Media as PayloadMedia } from '../../../payload/payload-types'
import type { Media as NativeMedia } from '../../domain/types'

export const toStorefrontMedia = (media: NativeMedia): PayloadMedia => ({
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
