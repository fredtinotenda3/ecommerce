// src/app/(admin)/admin/globals/page.tsx
//
// The three singleton globals: Header, Footer and Settings.
//
// Nav items are edited as a JSON array. They are an ordered list of links
// where each entry is either a page reference or a custom url, and the
// server validates every entry on save — an item that claims to be a
// reference but names no page is rejected rather than silently rendered as
// a dead link.

import Link from 'next/link'

import type { NavItem } from '../../../../lib/domain/types'
import { listMediaOptions, listPageOptions, withNoneOption } from '../../../_api/adminOptions'
import { fetchFooter, fetchHeader, fetchHome, fetchSettings } from '../../../_api/fetchGlobals'
import { getRepositories } from '../../../_api/repositories'
import { AdminForm } from '../_components/AdminForm'
import { AdminSection } from '../_components/AdminSection'

export const dynamic = 'force-dynamic'

const NAV_HELP =
  'JSON array. Each entry: { "type": "reference", "label": "Shop", "referencePageId": "<page id>" } or { "type": "custom", "label": "Blog", "url": "https://…" }. Optional: "newTab", "iconMediaId".'

/** Reads the globals in the domain shape the write API expects, so what an
 * operator edits round-trips exactly. The storefront's own `fetchHeader`
 * returns a view model with relations already resolved to slugs and urls,
 * which is the wrong shape to hand back to a save. */
const loadEditableGlobals = async () => {
  const { globals } = await getRepositories()
  const [header, footer, settings, home] = await Promise.all([
    globals.getHeader(),
    globals.getFooter(),
    globals.getSettings(),
    globals.getHome(),
  ])
  return { header, footer, settings, home }
}

export default async function AdminGlobalsPage() {
  const [{ header, footer, settings, home }, pages, imageOptions, videoOptions] =
    await Promise.all([
      loadEditableGlobals(),
      listPageOptions(),
      listMediaOptions('image'),
      listMediaOptions('video'),
    ])

  // Confirms the storefront read path resolves what was saved — the same
  // functions the site itself uses.
  const [resolvedHeader, resolvedFooter, resolvedSettings, resolvedHome] = await Promise.all([
    fetchHeader(),
    fetchFooter(),
    fetchSettings(),
    fetchHome(),
  ])

  /** The stored nav items, unwrapped to the `link` objects the form edits
   * and the API accepts. */
  const navItemsFor = (items: NavItem[] | undefined): unknown[] =>
    (items ?? []).map(item => item.link)

  return (
    <>
      <h1>Globals</h1>
      <p style={{ color: '#666' }}>
        Shared content that is not a page: the header and footer navigation, and site settings.
      </p>

      <AdminSection
        title="Header"
        description={`${resolvedHeader?.navItems?.length ?? 0} nav item(s) currently rendered on the storefront.`}
      >
        <AdminForm
          action="/api/admin/globals/header"
          method="PUT"
          submitLabel="Save header"
          successMessage="Header saved."
          fields={[
            {
              kind: 'json',
              name: 'navItems',
              label: 'Nav items',
              defaultValue: navItemsFor(header?.navItems),
              help: NAV_HELP,
              rows: 10,
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Footer"
        description={`${resolvedFooter?.navItems?.length ?? 0} nav item(s) currently rendered on the storefront.`}
      >
        <AdminForm
          action="/api/admin/globals/footer"
          method="PUT"
          submitLabel="Save footer"
          successMessage="Footer saved."
          fields={[
            {
              kind: 'text',
              name: 'copyright',
              label: 'Copyright line',
              defaultValue: footer?.copyright ?? '',
            },
            {
              kind: 'json',
              name: 'navItems',
              label: 'Nav items',
              defaultValue: navItemsFor(footer?.navItems),
              help: NAV_HELP,
              rows: 10,
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Settings"
        description={
          resolvedSettings?.productsPage
            ? 'The "continue shopping" links point at the page below.'
            : 'No products page set — "continue shopping" links are hidden until one is.'
        }
      >
        <AdminForm
          action="/api/admin/globals/settings"
          method="PUT"
          submitLabel="Save settings"
          successMessage="Settings saved."
          fields={[
            {
              kind: 'select',
              name: 'productsPageId',
              label: 'Products page',
              options: withNoneOption(pages),
              defaultValue: settings?.productsPageId ?? '',
              help: 'Where the cart and checkout send a shopper with an empty cart.',
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Home page"
        description={
          resolvedHome?.heroImage || resolvedHome?.heroHeading
            ? 'The homepage hero and brand-story video are using the content below.'
            : 'Not yet configured — the homepage is showing its built-in default hero and video. Fill in fields below and save to take over any of them; leave a field empty to keep the default.'
        }
      >
        <p style={{ color: '#666', marginTop: 0 }}>
          The homepage&apos;s section order is fixed in code (see the engineering notes on{' '}
          <code>[slug]/page.tsx</code>), but its hero copy/photo and brand-story video/copy are
          edited here. Leave any field empty to fall back to the built-in default for that field
          specifically — you do not need to fill in everything at once.
        </p>

        <AdminForm
          action="/api/admin/globals/home"
          method="PUT"
          submitLabel="Save home page content"
          successMessage="Home page content saved."
          fields={[
            { kind: 'text', name: 'heroEyebrow', label: 'Hero eyebrow', defaultValue: home?.heroEyebrow ?? '' },
            {
              kind: 'text',
              name: 'heroHeading',
              label: 'Hero heading (first line)',
              defaultValue: home?.heroHeading ?? '',
              help: 'e.g. "Smartphones and tech,"',
            },
            {
              kind: 'text',
              name: 'heroHeadingAccent',
              label: 'Hero heading (second line, muted tone)',
              defaultValue: home?.heroHeadingAccent ?? '',
              help: 'e.g. "sorted properly." — rendered as one H1 with the first line above.',
            },
            {
              kind: 'textarea',
              name: 'heroLede',
              label: 'Hero description',
              defaultValue: home?.heroLede ?? '',
            },
            {
              kind: 'json',
              name: 'heroProofPoints',
              label: 'Hero trust points',
              defaultValue: home?.heroProofPoints ?? [],
              help: 'JSON array of up to 3 short strings, e.g. ["Boxed & preloved stock", "Repairs done in-store"]. A fourth wraps to a second line on a phone and is rejected.',
              rows: 4,
            },
            {
              kind: 'text',
              name: 'heroPrimaryCtaLabel',
              label: 'Hero primary button label',
              defaultValue: home?.heroPrimaryCtaLabel ?? '',
            },
            {
              kind: 'text',
              name: 'heroPrimaryCtaHref',
              label: 'Hero primary button link',
              defaultValue: home?.heroPrimaryCtaHref ?? '',
              help: 'A path on this site ("/products") or a full https:// URL. Set together with the label above, or leave both empty.',
            },
            {
              kind: 'text',
              name: 'heroSecondaryCtaLabel',
              label: 'Hero secondary button label',
              defaultValue: home?.heroSecondaryCtaLabel ?? '',
            },
            {
              kind: 'text',
              name: 'heroSecondaryCtaHref',
              label: 'Hero secondary button link',
              defaultValue: home?.heroSecondaryCtaHref ?? '',
            },
            {
              kind: 'select',
              name: 'heroImageId',
              label: 'Hero product photo',
              options: withNoneOption(imageOptions),
              defaultValue: home?.heroImageId ?? '',
              help: 'Upload the photo on the Media screen first, then pick it here. Its own alt text (set on the Media screen) is what screen readers announce.',
            },
            {
              kind: 'text',
              name: 'videoEyebrow',
              label: 'Video section eyebrow',
              defaultValue: home?.videoEyebrow ?? '',
            },
            {
              kind: 'text',
              name: 'videoHeading',
              label: 'Video section heading',
              defaultValue: home?.videoHeading ?? '',
            },
            {
              kind: 'textarea',
              name: 'videoLede',
              label: 'Video section description',
              defaultValue: home?.videoLede ?? '',
            },
            {
              kind: 'text',
              name: 'videoLinkLabel',
              label: 'Video section link label',
              defaultValue: home?.videoLinkLabel ?? '',
              help: 'e.g. "See the full service list". Set together with the link below, or leave both empty.',
            },
            {
              kind: 'text',
              name: 'videoLinkHref',
              label: 'Video section link',
              defaultValue: home?.videoLinkHref ?? '',
            },
            {
              kind: 'select',
              name: 'videoId',
              label: 'Brand-story video',
              options: withNoneOption(videoOptions),
              defaultValue: home?.videoId ?? '',
              help: 'MP4 or WebM, uploaded on the Media screen.',
            },
            {
              kind: 'select',
              name: 'videoPosterId',
              label: 'Video poster image',
              options: withNoneOption(imageOptions),
              defaultValue: home?.videoPosterId ?? '',
              help: 'Shown before the video is played.',
            },
          ]}
        />
      </AdminSection>

      <p style={{ color: '#666' }}>
        Page ids for reference links are on the <Link href="/admin/pages">Pages</Link> screen.
      </p>
    </>
  )
}
