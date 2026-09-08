// src/app/(admin)/admin/orders/page.tsx
//
// Admin orders list, across all customers (see `OrderRepository.list`).

import { listAdminOrdersNative } from '../../../_api/adminQueries'
import { OrdersTable, type OrderRow } from './OrdersTable'

import classes from '../_components/admin.module.scss'

export const dynamic = 'force-dynamic'

export default async function NativeAdminOrdersPage() {
  const orders = await listAdminOrdersNative()

  const rows: OrderRow[] = orders.map(order => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customer: order.customerEmail ?? order.customerId,
    total: order.total,
    currency: order.currency,
    status: order.status,
    createdAt: new Date(order.createdAt).toISOString(),
  }))

  const awaitingAction = rows.filter(
    row => row.status === 'PAID' || row.status === 'PROCESSING',
  ).length

  return (
    <>
      <div className={classes.pageHeader}>
        <div>
          <h1 className={classes.pageTitle}>Orders</h1>
          <p className={classes.pageSubtitle}>
            {rows.length} total, {awaitingAction} awaiting fulfilment. Only legal status
            transitions are applied — anything else is reported per order.
          </p>
        </div>
      </div>

      <OrdersTable rows={rows} />
    </>
  )
}
