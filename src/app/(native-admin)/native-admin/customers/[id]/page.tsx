// src/app/(native-admin)/native-admin/customers/[id]/page.tsx
//
// PHASE 6 — read-only native admin customer detail: profile, orders, and
// purchases. Deliberately built from `AdminCustomerDetail` (see
// AdminQueryService.ts), which is constructed field-by-field from the
// storefront-safe `User` domain type — never from `AuthUserRecord` — so
// there is no password hash/salt/reset-token field to accidentally
// render here.

import { notFound } from 'next/navigation'

import { getAdminCustomerDetailNative } from '../../../../_api/adminQueries'

export const dynamic = 'force-dynamic'

export default async function NativeAdminCustomerDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const detail = await getAdminCustomerDetailNative(id)
  if (!detail) notFound()

  const { customer, orders, purchases } = detail

  return (
    <>
      <h1>{customer.name ?? 'Unnamed customer'}</h1>
      <dl>
        <dt>Email</dt>
        <dd>{customer.email}</dd>
        <dt>Roles</dt>
        <dd>{customer.roles.join(', ')}</dd>
        <dt>Created</dt>
        <dd>{new Date(customer.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(customer.updatedAt).toLocaleString()}</dd>
      </dl>

      <h2>Orders</h2>
      {orders.length === 0 ? (
        <p style={{ color: '#666' }}>No orders.</p>
      ) : (
        <ul>
          {orders.map(order => (
            <li key={order.id}>
              <a href={`/native-admin/orders/${order.id}`}>{order.orderNumber}</a> — {order.status}{' '}
              — {order.total} {order.currency}
            </li>
          ))}
        </ul>
      )}

      <h2>Purchases</h2>
      {purchases.length === 0 ? (
        <p style={{ color: '#666' }}>No purchases.</p>
      ) : (
        <ul>
          {purchases.map(product => (
            <li key={product.id}>
              <a href={`/native-admin/products/${product.id}`}>{product.title}</a> ({product.slug})
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
