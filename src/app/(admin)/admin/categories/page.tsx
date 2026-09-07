// src/app/(admin)/admin/categories/page.tsx
//
// read-only admin categories list. No detail page was
// requested for categories in the Phase 6 scope, so this is list-only.

import { listAdminCategoriesNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function NativeAdminCategoriesPage() {
  const categories = await listAdminCategoriesNative()

  return (
    <>
      <h1>Categories</h1>
      <AdminTable
        rows={categories}
        columns={[
          { header: 'Title', render: c => c.title },
          { header: 'Parent', render: c => c.parentTitle ?? '—' },
          { header: 'Media', render: c => (c.mediaId ? c.mediaId : '—') },
          { header: 'Created', render: c => new Date(c.createdAt).toLocaleString() },
          { header: 'Updated', render: c => new Date(c.updatedAt).toLocaleString() },
        ]}
      />
    </>
  )
}
