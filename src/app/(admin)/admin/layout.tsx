// src/app/(admin)/admin/layout.tsx
//
// Gate for the entire admin route group. Every page under /admin/* nests
// inside this layout, so one check authorizes all of them.
//
// Returns 404 (via `notFound()`) rather than a redirect or 401/403,
// whichever the reason — no session, a non-admin session, an expired
// token. An unauthorized caller learns nothing about whether the admin
// area exists.
//
// There is no login UI here: a valid session must already exist, obtained
// through /api/auth/login.

import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { getAdminAccess } from '../../_api/adminAccess'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminAccess()

  if (!access.authorized) {
    notFound()
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '1rem' }}>
        <strong>Admin</strong>
        <span style={{ marginLeft: '0.75rem', color: '#666' }}>
          Signed in as {access.user?.email}
        </span>
        <nav style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
          <a href="/admin/products">Products</a>
          <a href="/admin/categories">Categories</a>
          <a href="/admin/orders">Orders</a>
          <a href="/admin/customers">Customers</a>
          <a href="/admin/pages">Pages</a>
          <a href="/admin/media">Media</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
