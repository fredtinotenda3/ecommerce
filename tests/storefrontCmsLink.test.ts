// tests/storefrontCmsLink.test.ts
//
// PHASE 13K — type-level tests for the `StorefrontCMSLink`/
// `StorefrontNavItem`/`StorefrontHeader`/`StorefrontFooter` view models
// added to src/app/_types/storefront.ts (derived from `NativeCMSLink` in
// src/lib/domain/types.ts). Same rationale as
// tests/nativeCmsLayoutTypes.test.ts: these types have no runtime
// behavior of their own, so the main thing worth locking in is that the
// two real producers of Header/Footer nav data — the default Payload
// GraphQL path (`payload-types.ts`'s generated `Header`/`Footer`) and the
// flag-gated native path (`globalsStorefrontAdapter.ts`'s
// `toStorefrontHeader`/`toStorefrontFooter`) — both still satisfy the
// narrowed types unchanged. Each literal below only type-checks if that
// stays true, so a future edit that breaks the relationship fails
// `npm run test`'s `tsc`-backed collection step the same as `npx tsc
// --noEmit` would.
import { describe, expect, it } from 'vitest'

import type {
  StorefrontCMSLink,
  StorefrontFooter,
  StorefrontHeader,
  StorefrontNavItem,
} from '../src/app/_types/storefront'
import { toStorefrontFooter, toStorefrontHeader } from '../src/lib/repositories/adapters/globalsStorefrontAdapter'
import type { Header as PayloadHeader, Footer as PayloadFooter } from '../src/payload/payload-types'

describe('StorefrontCMSLink (Phase 13K)', () => {
  it('accepts a minimal custom link and a fully-populated reference link', () => {
    const custom: StorefrontCMSLink = { type: 'custom', url: '/shop', label: 'Shop' }
    expect(custom.url).toBe('/shop')

    const reference: StorefrontCMSLink = {
      type: 'reference',
      newTab: true,
      reference: { relationTo: 'pages', value: { slug: 'about' } },
      label: 'About',
      icon: { url: 'https://cdn.example.com/icon.svg' },
    }
    expect(reference.reference?.value).toEqual({ slug: 'about' })
  })

  it('accepts an unresolved (string) reference value, matching a not-yet-populated relation', () => {
    const link: StorefrontCMSLink = {
      type: 'reference',
      reference: { relationTo: 'pages', value: 'page-id-123' },
    }
    expect(typeof link.reference?.value).toBe('string')
  })

  it('accepts an unresolved (string) icon, matching payload-types.ts / NativeCMSLink', () => {
    const link: StorefrontCMSLink = { type: 'custom', url: '/x', icon: 'media-id-456' }
    expect(typeof link.icon).toBe('string')
  })
})

describe('StorefrontHeader / StorefrontFooter — real producers stay assignable (Phase 13K)', () => {
  it('accepts a real payload-types.ts Header object unchanged', () => {
    const now = new Date().toISOString()
    const payloadHeader: PayloadHeader = {
      id: 'header1',
      navItems: [
        {
          id: 'item1',
          link: {
            type: 'reference',
            newTab: false,
            reference: {
              relationTo: 'pages',
              value: {
                id: 'p1',
                title: 'Shop',
                slug: 'shop',
                hero: { type: 'none', richText: [], media: 'm1' },
                layout: [],
                updatedAt: now,
                createdAt: now,
              },
            },
            url: '',
            label: 'Shop',
          },
        },
      ],
      updatedAt: now,
      createdAt: now,
    }

    const storefrontHeader: StorefrontHeader = payloadHeader
    expect(storefrontHeader.navItems?.[0].link.label).toBe('Shop')
  })

  it('accepts a real payload-types.ts Footer object unchanged', () => {
    const now = new Date().toISOString()
    const payloadFooter: PayloadFooter = {
      id: 'footer1',
      copyright: '© 2026',
      navItems: [
        {
          id: 'item1',
          link: {
            type: 'custom',
            newTab: true,
            reference: { relationTo: 'pages', value: 'unused' },
            url: 'https://instagram.com/example',
            label: 'Instagram',
            icon: {
              id: 'm1',
              alt: 'Instagram',
              url: 'https://cdn.example.com/insta.svg',
              filename: 'insta.svg',
              mimeType: 'image/svg+xml',
              filesize: 1,
              width: 24,
              height: 24,
              updatedAt: now,
              createdAt: now,
            },
          },
        },
      ],
      updatedAt: now,
      createdAt: now,
    }

    const storefrontFooter: StorefrontFooter = payloadFooter
    expect(storefrontFooter.navItems?.[0].link.icon).toEqual(
      expect.objectContaining({ url: 'https://cdn.example.com/insta.svg' }),
    )
  })

  it('accepts the native repository adapter output (toStorefrontHeader/toStorefrontFooter) unchanged', () => {
    const resolved = {
      pageSlugsById: new Map([['page1', 'shop']]),
      mediaUrlsById: new Map([['media1', 'https://cdn.example.com/icon.svg']]),
    }

    const nativeHeader = toStorefrontHeader(
      {
        id: 'header1',
        navItems: [
          {
            link: {
              type: 'reference',
              label: 'Shop',
              referencePageId: 'page1',
              referenceRelationTo: 'pages',
              iconMediaId: 'media1',
            },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      resolved,
    )

    const storefrontHeader: StorefrontHeader = nativeHeader
    expect(storefrontHeader.navItems?.[0].link.reference).toEqual({
      relationTo: 'pages',
      value: { slug: 'shop' },
    })

    const nativeFooter = toStorefrontFooter(
      {
        id: 'footer1',
        copyright: '© 2026',
        navItems: [{ link: { type: 'custom', label: 'Instagram', url: 'https://instagram.com/x' } }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      resolved,
    )

    const storefrontFooter: StorefrontFooter = nativeFooter
    expect(storefrontFooter.navItems?.[0].link.url).toBe('https://instagram.com/x')
  })

  it('every StorefrontNavItem only needs an optional id, matching both producers', () => {
    const item: StorefrontNavItem = { link: { type: 'custom', url: '/x' } }
    expect(item.id).toBeUndefined()
  })
})
