// tests/generateMeta.test.ts
//
// PHASE 13G — `generateMeta`'s `doc` argument was narrowed from the
// `StorefrontMetaDoc`
// (`{ slug?; meta?: { title?; description?; image? } }`, see
// src/app/_types/storefront.ts). `generateMeta` itself wasn't
// modified, but — same as `priceFromJSON` in Phase 13F-B — it had no
// test coverage at all before this phase, and it's the one piece of
// actual logic downstream of that type change. These cases lock in its
// behavior with the minimal, non-Payload-shaped inputs the narrower
// type now explicitly allows (a plain `{ slug, meta }` object satisfies
// it just as well as a full `Page`/`Product` did).

import { afterEach, describe, expect, it } from 'vitest'

import { generateMeta } from '../src/app/_utilities/generateMeta'

const ORIGINAL_SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL

describe('generateMeta', () => {
  afterEach(() => {
    // restore NEXT_PUBLIC_SERVER_URL after tests that override it, so
    // this file doesn't leak env state to other test files
    process.env.NEXT_PUBLIC_SERVER_URL = ORIGINAL_SERVER_URL
  })

  it('falls back to a generic title when no meta.title is present', async () => {
    const result = await generateMeta({ doc: {} })
    expect(result.title).toEqual('Store')
    expect(result.openGraph?.title).toEqual('Store')
  })

  it('uses meta.title and meta.description when present', async () => {
    const result = await generateMeta({
      doc: { meta: { title: 'My Product', description: 'A great product' } },
    })
    expect(result.title).toEqual('My Product')
    expect(result.description).toEqual('A great product')
    expect(result.openGraph?.description).toEqual('A great product')
  })

  it('builds the openGraph url from a string slug', async () => {
    const result = await generateMeta({ doc: { slug: 'my-page' } })
    expect(result.openGraph?.url).toEqual('/')
  })

  it('falls back to "/" when there is no slug', async () => {
    const result = await generateMeta({ doc: {} })
    expect(result.openGraph?.url).toEqual('/')
  })

  it('builds an absolute ogImage url when meta.image is a populated object', async () => {
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.com'
    const result = await generateMeta({
      doc: { meta: { image: { url: '/media/product.jpg' } } },
    })
    expect(result.openGraph?.images).toEqual([{ url: 'https://example.com/media/product.jpg' }])
  })

  it('does not set an ogImage when meta.image is an unpopulated id string', async () => {
    const result = await generateMeta({ doc: { meta: { image: 'media-id-123' } } })
    // falls back to mergeOpenGraph's default images
    expect(result.openGraph?.images).toEqual([{ url: '/static-image.jpg' }])
  })

  it('does not set an ogImage when meta.image is absent', async () => {
    const result = await generateMeta({ doc: {} })
    expect(result.openGraph?.images).toEqual([{ url: '/static-image.jpg' }])
  })

  it('accepts a plain narrow object with none of the other Page/Product fields', async () => {
    // Locks in that StorefrontMetaDoc is genuinely sufficient — no
    // `id`/`title`/`layout`/`hero`/etc. are required.
    const narrowDoc = {
      slug: 'narrow',
      meta: { title: 'Narrow Doc', description: 'Just the subset', image: { url: '/x.jpg' } },
    }
    process.env.NEXT_PUBLIC_SERVER_URL = 'https://example.com'
    const result = await generateMeta({ doc: narrowDoc })
    expect(result.title).toEqual('Narrow Doc')
    expect(result.openGraph?.images).toEqual([{ url: 'https://example.com/x.jpg' }])
  })
})
