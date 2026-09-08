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
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getAdminAccess } from '../../_api/adminAccess'
import { AdminNav } from './_components/AdminNav'

import classes from './_components/admin.module.scss'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await getAdminAccess()

  if (!access.authorized) {
    notFound()
  }

  return (
    <div className={classes.shell}>
      <div className={classes.topBar}>
        <div className={classes.topBarInner}>
          <Link href="/admin" className={classes.brand}>
            Tech Haven
            <span className={classes.brandBadge}>Admin</span>
          </Link>

          <div className={classes.identity}>
            <span>{access.user?.email}</span>
            {/* A plain anchor, not a Link: leaving the admin should be a
                full navigation that discards any client cache of admin
                data. */}
            <a href="/" className={classes.button}>
              View store
            </a>
          </div>
        </div>

        <AdminNav />
      </div>

      <main className={classes.content}>{children}</main>
    </div>
  )
}
