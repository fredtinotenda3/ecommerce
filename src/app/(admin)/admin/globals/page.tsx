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
import { listPageOptions, withNoneOption } from '../../../_api/adminOptions'
import { fetchFooter, fetchHeader, fetchSettings } from '../../../_api/fetchGlobals'
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
  const [header, footer, settings] = await Promise.all([
    globals.getHeader(),
    globals.getFooter(),
    globals.getSettings(),
  ])
  return { header, footer, settings }
}

export default async function AdminGlobalsPage() {
  const [{ header, footer, settings }, pages] = await Promise.all([
    loadEditableGlobals(),
    listPageOptions(),
  ])

  // Confirms the storefront read path resolves what was saved — the same
  // functions the site itself uses.
  const [resolvedHeader, resolvedFooter, resolvedSettings] = await Promise.all([
    fetchHeader(),
    fetchFooter(),
    fetchSettings(),
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

      <p style={{ color: '#666' }}>
        Page ids for reference links are on the <Link href="/admin/pages">Pages</Link> screen.
      </p>
    </>
  )
}
