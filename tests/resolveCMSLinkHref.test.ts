// tests/resolveCMSLinkHref.test.ts
//
// PHASE 13K — unit tests for the link classification/reference-resolution
// logic extracted from `CMSLink` (see
// src/app/_components/Link/resolveHref.ts). Before this phase, this logic
// only existed inline inside a React component and had no direct test
// coverage; extracting it as a pure function makes it directly testable
// without rendering.
//
// These cases cover every branch of the pre-13K inline expression this
// function replaces (see resolveHref.ts's header comment for the exact
// expression) — reference vs. custom, populated vs. unpopulated
// (string-id) reference values, missing slug, and the `url` fallback —
// to lock in that the extraction did not change behavior.
import { describe, expect, it } from 'vitest'

import { resolveCMSLinkHref } from '../src/app/_components/Link/resolveHref'

describe('resolveCMSLinkHref', () => {
  it('resolves an internal reference link with a populated (object) value to /{slug}', () => {
    const href = resolveCMSLinkHref({
      type: 'reference',
      reference: { relationTo: 'pages', value: { slug: 'shop' } },
    })
    expect(href).toBe('/shop')
  })

  it('falls back to `url` when the reference value is still an unresolved string id', () => {
    const href = resolveCMSLinkHref({
      type: 'reference',
      reference: { relationTo: 'pages', value: 'page-id-123' },
      url: '/fallback',
    })
    expect(href).toBe('/fallback')
  })

  it('falls back to `url` (possibly undefined) when a populated reference value has no slug', () => {
    expect(
      resolveCMSLinkHref({
        type: 'reference',
        reference: { relationTo: 'pages', value: {} },
        url: '/fallback',
      }),
    ).toBe('/fallback')

    expect(
      resolveCMSLinkHref({
        type: 'reference',
        reference: { relationTo: 'pages', value: {} },
      }),
    ).toBeUndefined()
  })

  it('uses `url` directly for a custom link, ignoring any reference', () => {
    const href = resolveCMSLinkHref({
      type: 'custom',
      url: 'https://example.com',
      reference: { relationTo: 'pages', value: { slug: 'shop' } },
    })
    expect(href).toBe('https://example.com')
  })

  it('uses `url` when `type` is undefined (matching the pre-13K inline logic)', () => {
    expect(resolveCMSLinkHref({ url: '/no-type' })).toBe('/no-type')
  })

  it('returns undefined when neither a resolvable reference nor a url is present', () => {
    expect(resolveCMSLinkHref({})).toBeUndefined()
  })

  it('returns undefined when reference is present but value is missing entirely', () => {
    expect(
      resolveCMSLinkHref({
        type: 'reference',
        reference: { relationTo: 'pages' } as never,
      }),
    ).toBeUndefined()
  })
})
