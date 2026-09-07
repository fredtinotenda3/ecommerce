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
  const { authUsers } = await getRepositories()
  return resolveAdminAccess({ token }, { userRepository: authUsers })
}
