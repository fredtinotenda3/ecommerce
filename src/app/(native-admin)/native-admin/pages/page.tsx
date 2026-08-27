// src/app/(native-admin)/native-admin/pages/page.tsx
//
// PHASE 6 — read-only native admin CMS pages list.

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
        rowHref={row => `/native-admin/pages/${row.id}`}
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
