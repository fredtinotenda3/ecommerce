// src/app/(admin)/admin/orders/page.tsx
//
// read-only admin orders list, across all customers
// (see OrderRepository.list, added this phase for exactly this).

import { listAdminOrdersNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function NativeAdminOrdersPage() {
  const orders = await listAdminOrdersNative()

  return (
    <>
      <h1>Orders</h1>
      <AdminTable
        rows={orders}
        rowHref={row => `/admin/orders/${row.id}`}
        columns={[
          { header: 'Order #', render: o => o.orderNumber },
          { header: 'Customer', render: o => o.customerEmail ?? o.customerId },
          { header: 'Total', render: o => `${o.total} ${o.currency}` },
          { header: 'Status', render: o => o.status },
          { header: 'Created', render: o => new Date(o.createdAt).toLocaleString() },
        ]}
      />
    </>
  )
}
