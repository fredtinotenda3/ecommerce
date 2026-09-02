// src/app/_components/Link/resolveHref.ts
//
// PHASE 13K — link classification/reference-resolution logic extracted
// out of `CMSLink` (see ./index.tsx) into a pure, dependency-free
// function so it can be unit tested directly (see
// tests/resolveCMSLinkHref.test.ts) without rendering React. Behavior is
// byte-for-byte identical to the inline expression this replaces — this
// is an extraction, not a rewrite:
//
//   const href =
//     type === 'reference' && typeof reference?.value === 'object' && reference.value.slug
//       ? `${reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''}/${
//           reference.value.slug
//         }`
//       : url
//
// Typed against `StorefrontCMSLink` (src/app/_types/storefront.ts), the
// narrow, `NativeCMSLink`-derived view model `CMSLink` now uses — see that
// file for why a full `NativeCMSLink`/domain `Page` isn't safe here.
import type { StorefrontCMSLink } from '../../_types/storefront'

export type ResolvableCMSLink = Pick<StorefrontCMSLink, 'type' | 'reference' | 'url'>

/** Resolves a `CMSLink`'s effective `href`:
 * - an internal `reference` link with a populated (object) value and a
 *   `slug` resolves to `/{relationTo prefix}/{slug}` (the `relationTo`
 *   prefix is only ever empty today — `relationTo` is always `'pages'` —
 *   but the branch is preserved unchanged from the original inline logic)
 * - anything else (a `custom` link, an unpopulated/string reference
 *   value, or a reference with no slug) falls back to the plain `url`
 *   field, which may itself be `undefined`
 */
export function resolveCMSLinkHref(link: ResolvableCMSLink): string | undefined {
  const { type, reference, url } = link

  if (type === 'reference' && typeof reference?.value === 'object' && reference.value?.slug) {
    const prefix = reference?.relationTo !== 'pages' ? `/${reference?.relationTo}` : ''
    return `${prefix}/${reference.value.slug}`
  }

  return url
}
