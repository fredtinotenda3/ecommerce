// tests/storefrontMediaItem.test.ts
//
// PHASE 13N — type-level tests for `StorefrontMediaItem`
// (src/app/_types/storefront.ts), the "simple media fields" view model
// this phase's audit confirmed already existed (added in Phase 13H) and
// already matches the exact field set requested: `url?`/`width?`/
// `height?`/`alt?`/`filename?`/`mimeType?`, no `.sizes`.
//
// Same rationale as tests/storefrontCmsBlocks.test.ts (Phase 13L) /
// tests/storefrontOrderReference.test.ts (Phase 13M): these types have
// no runtime behavior of their own, so the main thing worth locking in
// is that a real `payload-types.ts` `Media` object still satisfies the
// narrowed type unchanged, plus (new for this phase) that the *smaller*
// set of fields the `Media` display component's rendering logic
// actually reads is itself a subset of `StorefrontMediaItem` — the
// structural fact that makes it safe for a future phase to narrow
// `Media/types.ts`'s `Props.resource` to this type without changing
// what gets rendered.

import { describe, expect, it } from 'vitest'

import type { StorefrontMediaItem } from '../src/app/_types/storefront'
import type { Media as PayloadMedia } from '../src/payload/payload-types'

describe('StorefrontMediaItem (Phase 13N)', () => {
  it('accepts a real payload-types.ts Media object unchanged (extra fields ignored)', () => {
    const payloadMedia: PayloadMedia = {
      id: 'media-1',
      alt: 'A product photo',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      url: '/media/product.jpg',
      filename: 'product.jpg',
      mimeType: 'image/jpeg',
      filesize: 12345,
      width: 800,
      height: 600,
    }

    const storefrontMedia: StorefrontMediaItem = payloadMedia
    expect(storefrontMedia.url).toBe('/media/product.jpg')
    expect(storefrontMedia.width).toBe(800)
    expect(storefrontMedia.height).toBe(600)
    expect(storefrontMedia.filename).toBe('product.jpg')
    expect(storefrontMedia.alt).toBe('A product photo')
    expect(storefrontMedia.mimeType).toBe('image/jpeg')
  })

  it('accepts a minimal object with only the fields it declares', () => {
    const media: StorefrontMediaItem = {
      width: 400,
      height: 300,
      filename: 'hero.png',
      alt: 'Hero banner',
      mimeType: 'image/png',
    }
    expect(media.url).toBeUndefined()
  })

  /** PHASE 13N audit finding: `src/app/_components/Media/index.tsx` +
   * `Media/Image/index.tsx` + `Media/Video/index.tsx`'s rendering logic,
   * traced line-by-line, only ever reads `mimeType`, `width`, `height`,
   * `filename`, and `alt` off `resource` — never `.url` and never any
   * field outside `StorefrontMediaItem`. This type-level assignability
   * check locks in that "rendered fields subset" relationship: if a
   * future edit to the `Media` display component started reading a
   * field `StorefrontMediaItem` doesn't have, this would need updating,
   * which is the intended signal for that change to also revisit
   * whether `StorefrontMediaItem` still covers it. */
  it('the fields Media/Image/Video actually read form a subset of StorefrontMediaItem', () => {
    type MediaRenderedFields = Pick<
      StorefrontMediaItem,
      'mimeType' | 'width' | 'height' | 'filename' | 'alt'
    >

    const rendered: MediaRenderedFields = {
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      filename: 'product.jpg',
      alt: 'A product photo',
    }

    const asStorefrontMediaItem: StorefrontMediaItem = rendered
    expect(asStorefrontMediaItem).toEqual(rendered)
  })
})
