// src/app/_api/adminAccess.ts
//
// Request- and DB-wired entry point for admin authorization.
// `AdminAccessService.ts` holds the decision itself and takes a repository
// interface for unit testing; this file reads the request's session token
// and supplies the real repository.
//
// Used by the admin route group's layout, which is what enforces the check
// for every page beneath it.

import { type AdminAccessResult, resolveAdminAccess } from '../../lib/services/AdminAccessService'
import { extractSessionToken } from './authenticatedUser'
import { getRepositories } from './repositories'

export const getAdminAccess = async (): Promise<AdminAccessResult> => {
  const token = extractSessionToken()

  // Short-circuit before touching the database. An anonymous request can
  // never be authorized, so opening a connection for it is wasted work —
  // and it means an unauthenticated scan of the admin surface still gets a
  // clean 404 when the database is unreachable, rather than a 500 that
  // says something is there to break.
  if (!token) return { authorized: false, user: null }

  const { authUsers } = await getRepositories()
  return resolveAdminAccess({ token }, { userRepository: authUsers })
}
