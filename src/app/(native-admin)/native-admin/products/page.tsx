// src/app/(native-admin)/native-admin/products/page.tsx
//
// PHASE 6 — read-only native admin products list. Access is already
// enforced by the parent layout (src/app/(native-admin)/native-admin/
// layout.tsx); this page only fetches and renders.

import { listAdminProductsNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function NativeAdminProductsPage() {
  const products = await listAdminProductsNative()

  return (
    <>
      <h1>Products</h1>
      <AdminTable
        rows={products}
        rowHref={row => `/native-admin/products/${row.id}`}
        columns={[
          { header: 'Title', render: p => p.title },
          { header: 'Slug', render: p => p.slug },
          { header: 'Status', render: p => p.status },
          {
            header: 'Price',
            render: p => (p.price != null ? `${p.price} ${p.currency ?? ''}` : '—'),
          },
          { header: 'Categories', render: p => p.categoryIds.length },
          { header: 'Updated', render: p => new Date(p.updatedAt).toLocaleString() },
        ]}
      />
    </>
  )
}
