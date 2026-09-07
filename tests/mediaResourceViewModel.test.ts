// tests/mediaResourceViewModel.test.ts
//
// PHASE 13V — type-level regression tests for narrowing
// `src/app/_components/Media/types.ts`'s `Props.resource` from
// `string | payload-types.ts Media` to `string | StorefrontMediaItem`
// (the Phase 13N audit's flagged follow-up — see `StorefrontMediaItem`'s
// own doc comment in `src/app/_types/storefront.ts`), and for the new
// `StorefrontHeroMedia` view model (`StorefrontMediaItem` plus `caption`,
// for the two callers that read it directly).
//
// These types have no runtime behavior of their own (same rationale as
// every prior phase's `Storefront*` type-level test) — what matters is
// that the relationships this phase depends on stay true: a future edit
// that breaks one of them fails `npm run test`'s `tsc`-backed collection
// step the same way a plain `npx tsc --noEmit` would, not silently.
//
// Four things are proved here:
//   1. A real `payload-types.ts` `Media` object still satisfies
//      `Media/types.ts`'s narrowed `Props.resource` unchanged.
//   2. A real `payload-types.ts` `Media` object still satisfies the new
//      `StorefrontHeroMedia` view model unchanged (including `.caption`).
//   3. `ProductHero`, `HighImpactHero`, `MediumImpactHero`, and
//      `MediaBlock` all still accept a real, full `payload-types.ts`
//      `Media`/`Product` value for their media-bearing prop, with no
//      caller-side edits — this is what every existing caller (`Hero`/
//      `Blocks` dispatchers, `products/[slug]/page.tsx`, the styleguide
//      media-block page) relies on.
//   4. `Media`'s own `Props` type (used directly by `<Media resource=
//      {...} />`) accepts both a bare `StorefrontMediaItem` and a
//      `StorefrontHeroMedia`.

import { describe, expect, it } from 'vitest'

import { MediaBlock } from '../src/app/_blocks/MediaBlock'
import { Props as MediaProps } from '../src/app/_components/Media/types'
import { HighImpactHero } from '../src/app/_heros/HighImpact'
import { MediumImpactHero } from '../src/app/_heros/MediumImpact'
import { ProductHero } from '../src/app/_heros/Product'
import type { StorefrontHeroMedia, StorefrontMediaItem } from '../src/app/_types/storefront'
import type { Media as PayloadMedia, Product as PayloadProduct } from '../src/payload/payload-types'

const buildPayloadMedia = (overrides: Partial<PayloadMedia> = {}): PayloadMedia => ({
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
  ...overrides,
})

describe("Media/types.ts's narrowed Props.resource (Phase 13V)", () => {
  it('accepts a real payload-types.ts Media object unchanged', () => {
    const payloadMedia = buildPayloadMedia()

    const props: MediaProps = { resource: payloadMedia }
    expect(props.resource).toEqual(payloadMedia)
  })

  it('accepts a bare string (unresolved media id)', () => {
    const props: MediaProps = { resource: 'media-id' }
    expect(props.resource).toBe('media-id')
  })

  it('accepts a minimal StorefrontMediaItem with only the fields Media/Image/Video read', () => {
    const media: StorefrontMediaItem = {
      mimeType: 'image/png',
      width: 400,
      height: 300,
      filename: 'hero.png',
      alt: 'Hero banner',
    }
    const props: MediaProps = { resource: media }
    expect(props.resource).toEqual(media)
  })
})

describe('StorefrontHeroMedia (Phase 13V)', () => {
  it('accepts a real payload-types.ts Media object unchanged, including .caption', () => {
    const payloadMedia = buildPayloadMedia({ caption: [{ type: 'p', text: 'A caption.' }] })

    const media: StorefrontHeroMedia = payloadMedia
    expect(media.caption).toEqual([{ type: 'p', text: 'A caption.' }])
    expect(media.filename).toBe('product.jpg')
  })

  it('accepts a minimal object with no caption', () => {
    const media: StorefrontHeroMedia = { filename: 'plain.jpg' }
    expect(media.caption).toBeUndefined()
  })
})

describe('ProductHero media prop (Phase 13V)', () => {
  it('accepts a real payload-types.ts Product with a populated meta.image', () => {
    const payloadProduct: PayloadProduct = {
      id: 'product-1',
      title: 'Trail Boots',
      slug: 'trail-boots',
      priceJSON: JSON.stringify({ data: [{ unit_amount: 4999, type: 'one_time' }] }),
      meta: { description: 'Rugged.', image: buildPayloadMedia() },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as PayloadProduct

    // Exactly what `src/app/(pages)/products/[slug]/page.tsx` does today:
    // pass the fetched product straight into `<ProductHero product={...}
    // />` — this only type-checks if `ProductHero`'s prop type still
    // accepts a real `Media` object for `meta.image` with no cast, now
    // that `Media/types.ts` (and this file's `meta.image` override) are
    // typed against `StorefrontMediaItem` instead of the full generated
    // `Media`.
    const props: Parameters<typeof ProductHero>[0] = { product: payloadProduct }
    expect(props.product.meta?.image).toEqual(buildPayloadMedia())
  })

  it('accepts a Product with an unresolved (string) meta.image', () => {
    const payloadProduct: PayloadProduct = {
      id: 'product-1',
      title: 'Trail Boots',
      meta: { image: 'media-id' },
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as PayloadProduct

    const props: Parameters<typeof ProductHero>[0] = { product: payloadProduct }
    expect(props.product.meta?.image).toBe('media-id')
  })
})

describe('HighImpactHero / MediumImpactHero media prop (Phase 13V)', () => {
  it('HighImpactHero accepts a real payload-types.ts Media object (with caption) unchanged', () => {
    const payloadMedia = buildPayloadMedia({ caption: [{ type: 'p', text: 'A caption.' }] })

    const props: Parameters<typeof HighImpactHero>[0] = {
      richText: [],
      media: payloadMedia,
    }
    expect(props.media).toEqual(payloadMedia)
  })

  it('MediumImpactHero accepts a real payload-types.ts Media object unchanged', () => {
    const payloadMedia = buildPayloadMedia()

    const props: Parameters<typeof MediumImpactHero>[0] = {
      richText: [],
      media: payloadMedia,
    }
    expect(props.media).toEqual(payloadMedia)
  })
})

describe('MediaBlock media prop (Phase 13V)', () => {
  it('accepts a real payload-types.ts Media object (with caption) unchanged', () => {
    const payloadMedia = buildPayloadMedia({ caption: [{ type: 'p', text: 'A caption.' }] })

    const props: Parameters<typeof MediaBlock>[0] = {
      blockType: 'mediaBlock',
      position: 'default',
      media: payloadMedia,
    }
    expect(props.media).toEqual(payloadMedia)
  })

  it('accepts an unresolved (string) media value, e.g. the styleguide page passing ""', () => {
    const props: Parameters<typeof MediaBlock>[0] = {
      blockType: 'mediaBlock',
      position: 'default',
      media: '',
    }
    expect(props.media).toBe('')
  })
})
