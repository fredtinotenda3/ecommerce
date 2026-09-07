// src/app/(admin)/admin/pages/page.tsx
//
// CMS pages list.

import Link from 'next/link'

import { listAdminPagesNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function AdminPagesPage() {
  const pages = await listAdminPagesNative()

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Pages</h1>
        <Link href="/admin/pages/new">New page</Link>
      </div>
      <AdminTable
        rows={pages}
        rowHref={row => `/admin/pages/${row.id}`}
        columns={[
          { header: 'Title', render: p => p.title },
          { header: 'Slug', render: p => `/${p.slug}` },
          { header: 'Status', render: p => p.status },
          { header: 'Updated', render: p => new Date(p.updatedAt).toLocaleString() },
        ]}
      />
    </>
  )
}
