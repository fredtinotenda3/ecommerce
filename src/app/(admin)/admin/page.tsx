// src/app/(admin)/admin/page.tsx
//
// minimal index for /admin itself, linking to each
// section. Access is already enforced by the parent layout.

import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function NativeAdminIndexPage() {
  return (
    <>
      <h1>Admin</h1>
      <p style={{ color: '#666' }}>
        Read-only foundation (Phase 6). Pick a section below.
      </p>
      <ul>
        <li>
          <Link href="/admin/products">Products</Link>
        </li>
        <li>
          <Link href="/admin/categories">Categories</Link>
        </li>
        <li>
          <Link href="/admin/orders">Orders</Link>
        </li>
        <li>
          <Link href="/admin/customers">Customers</Link>
        </li>
        <li>
          <Link href="/admin/pages">Pages</Link>
        </li>
        <li>
          <Link href="/admin/media">Media</Link>
        </li>
      </ul>
    </>
  )
}
