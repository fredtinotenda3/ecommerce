// src/app/(admin)/admin/orders/[id]/page.tsx
//
// Order detail: line items, totals, payments and customer, plus the two
// status controls an operator needs.
//
// Both controls only offer transitions the state machine allows from the
// current status, so an invalid move is not presented in the first place —
// and is rejected server-side regardless.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import { getAdminOrderDetailNative } from '../../../../_api/adminQueries'
import {
  allowedOrderTransitions,
  allowedPaymentTransitions,
} from '../../../../../lib/services/AdminContentService'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'

export const dynamic = 'force-dynamic'

export default async function AdminOrderDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const detail = await getAdminOrderDetailNative(id)
  if (!detail) notFound()

  const { order, customer, payments } = detail

  const orderStatusOptions = [order.status, ...allowedOrderTransitions(order.status)].map(
    status => ({ value: status, label: status }),
  )

  return (
    <>
      <p>
        <Link href="/admin/orders">← Orders</Link>
      </p>
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

      <div style={{ marginTop: '2rem' }}>
        <AdminSection
          title="Order status"
          description="Only transitions valid from the current status are offered."
        >
          {orderStatusOptions.length <= 1 ? (
            <p style={{ color: '#666' }}>
              {order.status} is a final status — there is nothing further to move to.
            </p>
          ) : (
            <AdminForm
              action={`/api/admin/orders/${order.id}`}
              method="PATCH"
              submitLabel="Update order status"
              successMessage="Order status updated."
              fields={[
                {
                  kind: 'select',
                  name: 'status',
                  label: 'Status',
                  defaultValue: order.status,
                  options: orderStatusOptions,
                  help: 'Marking an order paid requires a payment the provider has already confirmed.',
                },
              ]}
            />
          )}
        </AdminSection>

        {payments.map(payment => {
          const options = [payment.status, ...allowedPaymentTransitions(payment.status)].map(
            status => ({ value: status, label: status }),
          )

          return (
            <AdminSection
              key={payment.id}
              title={`Payment ${payment.merchantReference}`}
              description="Payment status is normally written by the Paynow callback. Use this only to record something the provider cannot tell us — a refund issued in Paynow's own dashboard, say."
            >
              {options.length <= 1 ? (
                <p style={{ color: '#666' }}>
                  {payment.status} is a final status for this payment.
                </p>
              ) : (
                <AdminForm
                  action={`/api/admin/orders/${order.id}`}
                  method="PATCH"
                  submitLabel="Update payment status"
                  successMessage="Payment status updated."
                  fields={[
                    {
                      kind: 'select',
                      name: 'paymentId',
                      label: 'Payment',
                      defaultValue: payment.id,
                      options: [{ value: payment.id, label: payment.merchantReference }],
                    },
                    {
                      kind: 'select',
                      name: 'paymentStatus',
                      label: 'Status',
                      defaultValue: payment.status,
                      options,
                    },
                  ]}
                />
              )}
            </AdminSection>
          )
        })}
      </div>
    </>
  )
}
