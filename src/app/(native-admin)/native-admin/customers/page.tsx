// src/app/(native-admin)/native-admin/customers/page.tsx
//
// PHASE 6 — read-only native admin customers list. Reads via the
// storefront-safe UserRepository (not AuthUserRepository), so no
// password/auth-internal fields ever enter this page.

import { listAdminCustomersNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function NativeAdminCustomersPage() {
  const customers = await listAdminCustomersNative()

  return (
    <>
      <h1>Customers</h1>
      <AdminTable
        rows={customers}
        rowHref={row => `/native-admin/customers/${row.id}`}
        columns={[
          { header: 'Name', render: c => c.name ?? 'Unnamed' },
          { header: 'Email', render: c => c.email },
          { header: 'Roles', render: c => c.roles.join(', ') },
          { header: 'Created', render: c => new Date(c.createdAt).toLocaleString() },
        ]}
      />
    </>
  )
}
