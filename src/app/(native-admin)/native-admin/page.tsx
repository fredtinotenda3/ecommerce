// src/app/(native-admin)/native-admin/page.tsx
//
// PHASE 6 — minimal index for /native-admin itself, linking to each
// section. Access is already enforced by the parent layout.

import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function NativeAdminIndexPage() {
  return (
    <>
      <h1>Native Admin</h1>
      <p style={{ color: '#666' }}>
        Read-only foundation (Phase 6). Pick a section below.
      </p>
      <ul>
        <li>
          <Link href="/native-admin/products">Products</Link>
        </li>
        <li>
          <Link href="/native-admin/categories">Categories</Link>
        </li>
        <li>
          <Link href="/native-admin/orders">Orders</Link>
        </li>
        <li>
          <Link href="/native-admin/customers">Customers</Link>
        </li>
        <li>
          <Link href="/native-admin/pages">Pages</Link>
        </li>
        <li>
          <Link href="/native-admin/media">Media</Link>
        </li>
      </ul>
    </>
  )
}
