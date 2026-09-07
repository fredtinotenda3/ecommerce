// src/lib/repositories/adapters/globalsStorefrontAdapter.ts
//
// Maps the native Header/Footer/Settings globals onto the storefront view
// models `HeaderNav`, `FooterComponent`, `CMSLink` and the cart/checkout/
// logout pages read.
//
// Pure functions, no I/O — relation resolution (page id -> slug, media id
// -> url) happens in the caller (see fetchGlobals.ts), the same division of
// responsibility as pageStorefrontAdapter.ts.

import type {
  StorefrontCMSLink,
  StorefrontFooter,
  StorefrontHeader,
  StorefrontNavItem,
  StorefrontSettingsLike,
} from '../../../app/_types/storefront'
import type {
  Footer as NativeFooter,
  Header as NativeHeader,
  NavItem,
  Settings as NativeSettings,
} from '../../domain/types'

/** Already relation-resolved by the caller: page ids -> slugs, media ids ->
 * urls, for every id referenced by the nav items being converted. */
export interface ResolvedNavRelations {
  pageSlugsById: Map<string, string>
  mediaUrlsById: Map<string, string | null>
}

const toStorefrontLink = (item: NavItem, resolved: ResolvedNavRelations): StorefrontCMSLink => {
  const { link } = item

  const slug = link.referencePageId ? resolved.pageSlugsById.get(link.referencePageId) : undefined
  const iconUrl = link.iconMediaId ? resolved.mediaUrlsById.get(link.iconMediaId) : undefined

  const built: StorefrontCMSLink = {
    type: link.type,
    newTab: link.newTab,
    url: link.url ?? undefined,
    label: link.label ?? undefined,
  }

  if (link.type === 'reference' && slug) {
    built.reference = { relationTo: 'pages', value: { slug } }
  }

  if (link.iconMediaId) {
    built.icon = { url: iconUrl ?? undefined }
  }

  return built
}

const toStorefrontNavItems = (
  navItems: NavItem[],
  resolved: ResolvedNavRelations,
): StorefrontNavItem[] => navItems.map(item => ({ link: toStorefrontLink(item, resolved) }))

export const toStorefrontHeader = (
  header: NativeHeader,
  resolved: ResolvedNavRelations,
): StorefrontHeader => ({
  navItems: toStorefrontNavItems(header.navItems, resolved),
})

export const toStorefrontFooter = (
  footer: NativeFooter,
  resolved: ResolvedNavRelations,
): StorefrontFooter => ({
  copyright: footer.copyright ?? '',
  navItems: toStorefrontNavItems(footer.navItems, resolved),
})

/** `productsPageSlug` is the already-resolved slug for
 * `settings.productsPageId` (or `null` when there is no linked page, or it
 * could not be found) — resolution happens in the caller. */
export const toStorefrontSettings = (
  settings: NativeSettings,
  productsPageSlug: string | null,
): StorefrontSettingsLike => ({
  productsPage:
    settings.productsPageId && productsPageSlug ? { slug: productsPageSlug } : undefined,
})
