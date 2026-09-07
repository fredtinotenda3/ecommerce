// src/app/(admin)/admin/pages/page.tsx
//
// read-only admin CMS pages list.

import { listAdminPagesNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function NativeAdminPagesPage() {
  const pages = await listAdminPagesNative()

  return (
    <>
      <h1>Pages</h1>
      <AdminTable
        rows={pages}
        rowHref={row => `/admin/pages/${row.id}`}
        columns={[
          { header: 'Title', render: p => p.title },
          { header: 'Slug', render: p => p.slug },
          { header: 'Status', render: p => p.status },
          { header: 'Updated', render: p => new Date(p.updatedAt).toLocaleString() },
        ]}
      />
    </>
  )
}
