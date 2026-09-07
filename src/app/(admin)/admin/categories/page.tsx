// src/app/(admin)/admin/categories/page.tsx
//
// Categories list, with an inline create form.

import Link from 'next/link'

import { listCategoryOptions, listMediaOptions, withNoneOption } from '../../../_api/adminOptions'
import { listAdminCategoriesNative } from '../../../_api/adminQueries'
import { AdminForm } from '../_components/AdminForm'
import { AdminSection } from '../_components/AdminSection'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function AdminCategoriesPage() {
  const [categories, categoryOptions, media] = await Promise.all([
    listAdminCategoriesNative(),
    listCategoryOptions(),
    listMediaOptions(),
  ])

  return (
    <>
      <h1>Categories</h1>

      <AdminTable
        rows={categories}
        rowHref={row => `/admin/categories/${row.id}`}
        columns={[
          { header: 'Title', render: c => c.title },
          { header: 'Parent', render: c => c.parentTitle ?? '—' },
          { header: 'Media', render: c => (c.mediaId ? 'Set' : '—') },
          { header: 'Updated', render: c => new Date(c.updatedAt).toLocaleString() },
        ]}
      />

      <div style={{ marginTop: '2rem' }}>
        <AdminSection title="New category">
          <AdminForm
            action="/api/admin/categories"
            method="POST"
            submitLabel="Create category"
            successMessage="Category created."
            fields={[
              { kind: 'text', name: 'title', label: 'Title', required: true },
              {
                kind: 'select',
                name: 'parentId',
                label: 'Parent category',
                options: withNoneOption(categoryOptions),
                defaultValue: '',
              },
              {
                kind: 'select',
                name: 'mediaId',
                label: 'Image',
                options: withNoneOption(media),
                defaultValue: '',
              },
            ]}
          />
        </AdminSection>
      </div>

      <p style={{ color: '#666' }}>
        Need to add an image first? <Link href="/admin/media">Upload one</Link>.
      </p>
    </>
  )
}
