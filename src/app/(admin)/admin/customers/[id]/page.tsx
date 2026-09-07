// src/app/(admin)/admin/customers/[id]/page.tsx
//
// Customer detail: profile, orders, purchases, and the role control.
//
// Built from `AdminCustomerDetail` (see AdminQueryService.ts), which is
// constructed field-by-field from the storefront-safe `User` domain type —
// never from `AuthUserRecord` — so there is no password hash, salt or
// reset token here to render by accident.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import { getAdminCustomerDetailNative } from '../../../../_api/adminQueries'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'

export const dynamic = 'force-dynamic'

export default async function AdminCustomerDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const detail = await getAdminCustomerDetailNative(id)
  if (!detail) notFound()

  const { customer, orders, purchases } = detail

  return (
    <>
      <p>
        <Link href="/admin/customers">← Customers</Link>
      </p>
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
              <a href={`/admin/orders/${order.id}`}>{order.orderNumber}</a> — {order.status}{' '}
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
              <a href={`/admin/products/${product.id}`}>{product.title}</a> ({product.slug})
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: '2rem' }}>
        <AdminSection
          title="Roles"
          description="Admins can reach /admin and every admin API. Customers cannot."
        >
          <AdminForm
            action={`/api/admin/users/${customer.id}`}
            method="PATCH"
            submitLabel="Save roles"
            successMessage="Roles updated."
            fields={[
              {
                kind: 'multiselect',
                name: 'roles',
                label: 'Roles',
                defaultValue: customer.roles,
                options: [
                  { value: 'customer', label: 'Customer' },
                  { value: 'admin', label: 'Admin' },
                ],
                help: 'You cannot remove your own admin role, and the last administrator cannot be demoted.',
              },
            ]}
          />
        </AdminSection>
      </div>

    </>
  )
}
