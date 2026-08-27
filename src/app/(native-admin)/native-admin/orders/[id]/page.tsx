// src/app/(native-admin)/native-admin/orders/[id]/page.tsx
//
// PHASE 6 — read-only native admin order detail: line items, totals,
// payment status/reference, and customer info.

import { notFound } from 'next/navigation'

import { getAdminOrderDetailNative } from '../../../../_api/adminQueries'

export const dynamic = 'force-dynamic'

export default async function NativeAdminOrderDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const detail = await getAdminOrderDetailNative(id)
  if (!detail) notFound()

  const { order, customer, payments } = detail

  return (
    <>
      <h1>Order {order.orderNumber}</h1>
      <dl>
        <dt>Status</dt>
        <dd>{order.status}</dd>
        <dt>Customer</dt>
        <dd>
          {customer ? (
            <>
              {customer.name ?? 'Unnamed'} ({customer.email})
            </>
          ) : (
            order.customerId || 'Unknown'
          )}
        </dd>
        <dt>Subtotal</dt>
        <dd>
          {order.subtotal} {order.currency}
        </dd>
        <dt>Total</dt>
        <dd>
          {order.total} {order.currency}
        </dd>
        <dt>Created</dt>
        <dd>{new Date(order.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(order.updatedAt).toLocaleString()}</dd>
      </dl>

      <h2>Items</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
              Title
            </th>
            <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
              Unit price
            </th>
            <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
              Quantity
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={`${item.productId}-${index}`} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.5rem' }}>{item.title}</td>
              <td style={{ padding: '0.5rem' }}>
                {item.unitPrice} {item.currency}
              </td>
              <td style={{ padding: '0.5rem' }}>{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Payments</h2>
      {payments.length === 0 ? (
        <p style={{ color: '#666' }}>No payment records.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
                Provider
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
                Status
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
                Reference
              </th>
              <th style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              <tr key={payment.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>{payment.provider}</td>
                <td style={{ padding: '0.5rem' }}>{payment.status}</td>
                <td style={{ padding: '0.5rem' }}>
                  {payment.providerReference ?? payment.merchantReference}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  {payment.amount} {payment.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
