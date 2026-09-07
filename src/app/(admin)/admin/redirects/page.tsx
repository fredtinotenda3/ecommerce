// src/app/(admin)/admin/redirects/page.tsx
//
// Managed redirects.
//
// These are applied at request time by the middleware, which caches the
// rule set for a minute — so a new rule takes effect within a minute
// without a rebuild.

import { getRepositories } from '../../../_api/repositories'
import { AdminForm } from '../_components/AdminForm'
import { AdminSection } from '../_components/AdminSection'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function AdminRedirectsPage() {
  const { redirects } = await getRepositories()
  const rules = await redirects.list()

  return (
    <>
      <h1>Redirects</h1>
      <p style={{ color: '#666' }}>
        Applied to incoming requests before any page renders. Changes take effect within a minute.
      </p>

      <AdminTable
        rows={rules}
        rowHref={row => `/admin/redirects/${row.id}`}
        emptyMessage="No redirects yet."
        columns={[
          { header: 'From', render: r => r.from },
          { header: 'To', render: r => r.to },
          { header: 'Type', render: r => (r.permanent ? '308 permanent' : '307 temporary') },
          { header: 'Enabled', render: r => (r.enabled ? 'Yes' : 'No') },
          { header: 'Updated', render: r => new Date(r.updatedAt).toLocaleString() },
        ]}
      />

      <div style={{ marginTop: '2rem' }}>
        <AdminSection title="New redirect">
          <AdminForm
            action="/api/admin/redirects"
            method="POST"
            submitLabel="Create redirect"
            successMessage="Redirect created."
            fields={[
              {
                kind: 'text',
                name: 'from',
                label: 'From',
                required: true,
                placeholder: '/old-product',
                help: 'A path on this site, starting with "/".',
              },
              {
                kind: 'text',
                name: 'to',
                label: 'To',
                required: true,
                placeholder: '/products/new-product',
                help: 'A path on this site, or a full https:// URL elsewhere.',
              },
              {
                kind: 'checkbox',
                name: 'permanent',
                label: 'Permanent (308)',
                defaultValue: false,
                help: 'Browsers cache permanent redirects hard and stop asking. Use it only when the move is final.',
              },
              { kind: 'checkbox', name: 'enabled', label: 'Enabled', defaultValue: true },
            ]}
          />
        </AdminSection>
      </div>
    </>
  )
}
