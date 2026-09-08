'use client'

// src/app/(admin)/admin/orders/OrdersTable.tsx
//
// Orders can be moved through their fulfilment statuses in bulk. They
// cannot be deleted — an order is a financial record, and the way to end
// one is a transition that leaves a trail.
//
// `PAID` is deliberately not offered: only the Paynow callback is
// authoritative about whether money arrived, and an operator marking an
// unpaid order as paid from a table is exactly the mistake that costs
// stock. The endpoint enforces the same restriction, so this is a UI
// convenience rather than the control.

import React from 'react'

import { formatMoney } from '../../../../lib/domain/money'
import type { OrderStatus } from '../../../../lib/domain/types'
import { BulkTable } from '../_components/BulkTable'

import classes from '../_components/admin.module.scss'

export interface OrderRow {
  id: string
  orderNumber: string
  customer: string
  total: number
  currency: string
  status: OrderStatus
  createdAt: string
}

/** Which badge a status wears. Anything that needs the operator to act is
 * a warning; anything that ended badly is a danger. */
const STATUS_TONE: Record<OrderStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PENDING_PAYMENT: 'warning',
  PAID: 'success',
  PROCESSING: 'warning',
  FULFILLED: 'success',
  PAYMENT_FAILED: 'danger',
  PAYMENT_CANCELLED: 'danger',
  CANCELLED: 'danger',
  REFUNDED: 'neutral',
}

const badgeFor = (status: OrderStatus): string => {
  switch (STATUS_TONE[status]) {
    case 'success':
      return classes.badgeSuccess
    case 'warning':
      return classes.badgeWarning
    case 'danger':
      return classes.badgeDanger
    default:
      return classes.badge
  }
}

/** `PENDING_PAYMENT` → `Pending payment`. */
const humanise = (status: string): string =>
  status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ')

export const OrdersTable = ({ rows }: { rows: OrderRow[] }) => (
  <BulkTable
    rows={rows}
    noun="order"
    endpoint="/api/admin/orders/bulk"
    rowHref={row => `/admin/orders/${row.id}`}
    rowLabel={row => `order ${row.orderNumber}`}
    emptyMessage="No orders yet."
    actions={[
      { value: 'PROCESSING', label: 'Mark processing' },
      { value: 'FULFILLED', label: 'Mark fulfilled' },
      { value: 'CANCELLED', label: 'Cancel', destructive: true },
      { value: 'REFUNDED', label: 'Mark refunded', destructive: true },
    ]}
    columns={[
      { header: 'Order', render: row => row.orderNumber, isPrimary: true },
      { header: 'Customer', render: row => row.customer },
      {
        header: 'Total',
        render: row => formatMoney({ amount: row.total, currency: row.currency }),
      },
      {
        header: 'Status',
        render: row => <span className={badgeFor(row.status)}>{humanise(row.status)}</span>,
      },
      { header: 'Placed', render: row => new Date(row.createdAt).toLocaleString() },
    ]}
  />
)
