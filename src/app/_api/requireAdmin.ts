// src/app/_api/requireAdmin.ts
//
// The single authorization gate for every admin write endpoint.
//
// Route handlers call `requireAdmin()` and return the response it hands
// back when it denies. There is deliberately one function rather than a
// check per route: an admin endpoint that forgets to authorize is the kind
// of bug that is invisible until it is exploited, and
// `tests/adminRouteAuthorization.test.ts` asserts that every route under
// /api/admin calls this.
//
// A denied request gets 404, not 403 — the same treatment the admin pages
// give — so the existence and shape of the admin API is not confirmed to
// an unauthorized caller.

import { NextResponse } from 'next/server'

import type { SanitizedAuthUser } from '../../lib/services/AuthService'
import { getAdminAccess } from './adminAccess'

export interface AdminAuthorization {
  /** Set when the caller is not an authorized admin: return it as-is. */
  denied: NextResponse | null
  /** The acting administrator, when authorized. Used for rules that depend
   * on who is acting — see `updateUserRoles`. */
  user: SanitizedAuthUser | null
}

export const requireAdmin = async (): Promise<AdminAuthorization> => {
  const access = await getAdminAccess()

  if (!access.authorized || !access.user) {
    return {
      denied: NextResponse.json({ error: 'Not found' }, { status: 404 }),
      user: null,
    }
  }

  return { denied: null, user: access.user }
}
