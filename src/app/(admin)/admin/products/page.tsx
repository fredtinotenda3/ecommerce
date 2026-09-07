// src/app/(admin)/admin/products/page.tsx
//
// Products list. Access is enforced by the route group's layout.

import Link from 'next/link'

import { listAdminProductsNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await listAdminProductsNative({ limit: 200 })

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Products</h1>
        <Link href="/admin/products/new">New product</Link>
      </div>
      <AdminTable
        rows={products}
        rowHref={row => `/admin/products/${row.id}`}
        columns={[
          { header: 'Title', render: p => p.title },
          { header: 'Slug', render: p => p.slug },
          { header: 'Status', render: p => p.status },
          {
            header: 'Price',
            render: p => (p.price != null ? `${p.price} ${p.currency ?? ''}` : 'Not set'),
          },
          { header: 'Categories', render: p => p.categoryIds.length },
          { header: 'Updated', render: p => new Date(p.updatedAt).toLocaleString() },
        ]}
      />
    </>
  )
}
