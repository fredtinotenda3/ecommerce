// src/app/(native-admin)/native-admin/layout.tsx
//
// PHASE 6 — gate for the entire native admin route group. Every page
// under /native-admin/* is nested inside this layout, so this single
// check enforces both the flag gate and admin authorization for all of
// them without repeating the check per-page.
//
// Returns 404 (via `notFound()`), never a redirect or 401/403, whether
// the cause is "flag off" or "not an authorized admin" — the task is
// explicit that the admin area's existence should not be revealed to an
// unauthorized caller, mirroring the 404-over-405 rationale already used
// by /api/auth-native/* (see src/app/api/auth-native/_shared/respond.ts).
//
// No login UI lives here (per the task) — a valid `native-session` must
// already exist (via the Phase 5 native auth endpoints) before this
// layout will render anything.

import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { getNativeAdminAccess } from '../../_api/adminAccess'

export const dynamic = 'force-dynamic'

export default async function NativeAdminLayout({ children }: { children: ReactNode }) {
  const access = await getNativeAdminAccess()

  if (!access.authorized) {
    notFound()
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '1rem' }}>
        <strong>Native Admin</strong>
        <span style={{ marginLeft: '0.75rem', color: '#666' }}>
          Signed in as {access.user?.email} (read-only foundation — Phase 6)
        </span>
        <nav style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem' }}>
          <a href="/native-admin/products">Products</a>
          <a href="/native-admin/categories">Categories</a>
          <a href="/native-admin/orders">Orders</a>
          <a href="/native-admin/customers">Customers</a>
          <a href="/native-admin/pages">Pages</a>
          <a href="/native-admin/media">Media</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  )
}
