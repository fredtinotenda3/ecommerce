// src/lib/repositories/adapters/globalsStorefrontAdapter.ts
//
// PHASE 13D — maps native domain Header/Footer/Settings records onto the
// exact shape the existing storefront components already expect from
// `payload-types.ts` (mirrors the HEADER/FOOTER/SETTINGS GraphQL queries
// field-for-field — see src/app/_graphql/globals.ts and src/app/_graphql/
// link.ts): navItems[].link.{type,newTab,url,label,reference.value.slug,
// icon.url}, Footer.copyright, Settings.productsPage.slug.
//
// This is a deliberately narrow, storefront-read-only adapter — it only
// populates the fields HeaderNav/FooterComponent/CMSLink and the
// cart/checkout/logout pages actually read (see src/app/_components/Header,
// src/app/_components/Footer, src/app/_components/Link). It must not be
// used to satisfy Payload's admin UI or any write path.
//
// Pure functions, no I/O — relation resolution (page id -> slug, media id
// -> url) happens in the caller (see fetchGlobalsNative.ts), same division
// of responsibility as pageStorefrontAdapter.ts/layoutRelationsAdapter.ts.

import type {
  Footer as PayloadFooter,
  Header as PayloadHeader,
  Settings as PayloadSettings,
} from '../../../payload/payload-types'
import type {
  Footer as NativeFooter,
  Header as NativeHeader,
  NavItem,
  Settings as NativeSettings,
} from '../../domain/types'

type PayloadNavItem = NonNullable<PayloadHeader['navItems']>[number]
type PayloadLink = PayloadNavItem['link']

/** Already relation-resolved by the caller: page ids -> slugs, media ids ->
 * urls, for every id referenced from the nav items being converted. */
export interface ResolvedNavRelations {
  pageSlugsById: Map<string, string>
  mediaUrlsById: Map<string, string | null>
}

const toStorefrontLink = (item: NavItem, resolved: ResolvedNavRelations): PayloadLink => {
  const { link } = item

  const slug = link.referencePageId ? resolved.pageSlugsById.get(link.referencePageId) : undefined
  const iconUrl = link.iconMediaId ? resolved.mediaUrlsById.get(link.iconMediaId) : undefined

  // Built as a loosely-typed record first (rather than casting an object
  // literal directly) so the single, clearly-marked cast below is on an
  // identifier — matches the cast style already used elsewhere in this
  // directory (see layoutRelationsAdapter.ts's
  // `buildMinimalStorefrontProduct(...) as PayloadProduct`). `reference`/
  // `label`/`url` are typed as required in payload-types.ts's generated
  // Header/Footer, but the real CMS data only ever populates the subset
  // that matches `type` — same structural gap the GraphQL path already has.
  const built: Record<string, unknown> = {
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

  return built as PayloadLink
}

const toStorefrontNavItems = (
  navItems: NavItem[],
  resolved: ResolvedNavRelations,
): PayloadNavItem[] =>
  navItems.map(item => ({
    link: toStorefrontLink(item, resolved),
  })) as PayloadNavItem[]

export const toStorefrontHeader = (
  header: NativeHeader,
  resolved: ResolvedNavRelations,
): PayloadHeader => ({
  id: header.id,
  navItems: toStorefrontNavItems(header.navItems, resolved),
  updatedAt: header.updatedAt.toISOString(),
  createdAt: header.createdAt.toISOString(),
})

export const toStorefrontFooter = (
  footer: NativeFooter,
  resolved: ResolvedNavRelations,
): PayloadFooter => ({
  id: footer.id,
  copyright: footer.copyright ?? '',
  navItems: toStorefrontNavItems(footer.navItems, resolved),
  updatedAt: footer.updatedAt.toISOString(),
  createdAt: footer.createdAt.toISOString(),
})

/** `productsPageSlug` is the already-resolved slug for
 * `settings.productsPageId` (or `null` if there is no linked page, or the
 * page could not be found) — resolution happens in the caller. */
export const toStorefrontSettings = (
  settings: NativeSettings,
  productsPageSlug: string | null,
): PayloadSettings => {
  const productsPage: Record<string, unknown> | undefined =
    settings.productsPageId && productsPageSlug ? { slug: productsPageSlug } : undefined

  return {
    id: settings.id,
    productsPage: productsPage as unknown as PayloadSettings['productsPage'],
    updatedAt: settings.updatedAt.toISOString(),
    createdAt: settings.createdAt.toISOString(),
  }
}
