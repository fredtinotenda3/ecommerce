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
  StorefrontFooterLinkGroup,
  StorefrontHeader,
  StorefrontHome,
  StorefrontMediaItem,
  StorefrontNavItem,
  StorefrontSettingsLike,
} from '../../../app/_types/storefront'
import type {
  Footer as NativeFooter,
  Header as NativeHeader,
  Home as NativeHome,
  NavItem,
  Settings as NativeSettings,
} from '../../domain/types'
import {
  DEFAULT_CONTACT,
  DEFAULT_FOOTER_LINK_GROUPS,
  DEFAULT_INCLUSIONS,
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_TAGLINE,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_TESTIMONIALS,
} from '../../domain/siteDefaults'

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

const toStorefrontFooterLinkGroups = (footer: NativeFooter): StorefrontFooterLinkGroup[] =>
  footer.linkGroups.length > 0 ? footer.linkGroups : DEFAULT_FOOTER_LINK_GROUPS

export const toStorefrontFooter = (
  footer: NativeFooter,
  resolved: ResolvedNavRelations,
): StorefrontFooter => ({
  copyright: footer.copyright ?? '',
  navItems: toStorefrontNavItems(footer.navItems, resolved),
  linkGroups: toStorefrontFooterLinkGroups(footer),
})

/** `productsPageSlug` is the already-resolved slug for
 * `settings.productsPageId` (or `null` when there is no linked page, or it
 * could not be found) — resolution happens in the caller.
 *
 * Every identity/contact/social/inclusion field falls back to
 * `siteDefaults.ts` independently when unset — same "an editor who has
 * only set one field does not lose the rest of the defaults" treatment
 * `Home`'s own adapter code already gives the hero fields. `brandBackgroundImage`
 * is already relation-resolved by the caller (see `buildStorefrontSettings`
 * in `fetchGlobals.ts`), the same division of responsibility
 * `toStorefrontHome` uses for its own media fields. */
export const toStorefrontSettings = (
  settings: NativeSettings,
  productsPageSlug: string | null,
  brandBackgroundImage: StorefrontMediaItem | null,
): StorefrontSettingsLike => ({
  productsPage:
    settings.productsPageId && productsPageSlug ? { slug: productsPageSlug } : undefined,
  siteName: settings.siteName || DEFAULT_SITE_NAME,
  siteTagline: settings.siteTagline || DEFAULT_SITE_TAGLINE,
  siteDescription: settings.siteDescription || DEFAULT_SITE_DESCRIPTION,
  contactEmail: settings.contactEmail || DEFAULT_CONTACT.email,
  contactPhone: settings.contactPhone || DEFAULT_CONTACT.phone,
  contactPhoneSecondary: settings.contactPhoneSecondary || DEFAULT_CONTACT.phoneSecondary,
  contactWhatsapp: settings.contactWhatsapp || DEFAULT_CONTACT.whatsapp,
  addressLines: settings.addressLines.length > 0 ? settings.addressLines : DEFAULT_CONTACT.addressLines,
  secondAddressLines:
    settings.secondAddressLines.length > 0 ? settings.secondAddressLines : DEFAULT_CONTACT.secondAddressLines,
  hours: settings.hours || DEFAULT_CONTACT.hours,
  socialLinks: settings.socialLinks.length > 0 ? settings.socialLinks : DEFAULT_SOCIAL_LINKS,
  inclusions: settings.inclusions.length > 0 ? settings.inclusions : DEFAULT_INCLUSIONS,
  // Unlike every other field above, an operator who has genuinely cleared
  // the testimonials list means "show none", not "not configured yet" — so
  // this does NOT fall back to a default (which is empty anyway; see
  // `DEFAULT_TESTIMONIALS`'s own comment). Kept explicit rather than
  // relying on the coincidence that the default happens to be `[]`.
  testimonials: settings.testimonials.length > 0 ? settings.testimonials : DEFAULT_TESTIMONIALS,
  brandBackgroundImage,
})

/** `mediaById` is already relation-resolved by the caller (see
 * `buildStorefrontHome` in `fetchGlobals.ts`) — this stays a pure mapping,
 * consistent with every other function in this file. */
export const toStorefrontHome = (
  home: NativeHome,
  mediaById: Map<string, StorefrontMediaItem | null>,
): StorefrontHome => ({
  heroEyebrow: home.heroEyebrow,
  heroHeading: home.heroHeading,
  heroHeadingAccent: home.heroHeadingAccent,
  heroLede: home.heroLede,
  heroProofPoints: home.heroProofPoints,
  heroPrimaryCtaLabel: home.heroPrimaryCtaLabel,
  heroPrimaryCtaHref: home.heroPrimaryCtaHref,
  heroSecondaryCtaLabel: home.heroSecondaryCtaLabel,
  heroSecondaryCtaHref: home.heroSecondaryCtaHref,
  heroImage: home.heroImageId ? mediaById.get(home.heroImageId) ?? null : null,
  videoEyebrow: home.videoEyebrow,
  videoHeading: home.videoHeading,
  videoLede: home.videoLede,
  videoLinkLabel: home.videoLinkLabel,
  videoLinkHref: home.videoLinkHref,
  video: home.videoId ? mediaById.get(home.videoId) ?? null : null,
  videoPoster: home.videoPosterId ? mediaById.get(home.videoPosterId) ?? null : null,
})
