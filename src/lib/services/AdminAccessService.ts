// src/lib/services/AdminAccessService.ts
//
// Authorization decision for the admin area. Orchestration only: takes an
// `AuthUserRepository` INTERFACE, so it is unit-testable with
// `tests/fakes/FakeAuthUserRepository.ts` and no database. Cookie/header
// and connection wiring live in `src/app/_api/adminAccess.ts`.
//
// Access rule: a valid session token whose user has the `admin` role.
// Everything else — no token, an expired or tampered token, a deleted
// user, a non-admin user — is the same "not authorized" result, with no
// detail about which. The caller turns that into a 404 rather than a
// 401/403, so the admin area's existence is never confirmed to an
// unauthorized caller.

import { isAdmin } from '../auth/roles'
import type { AuthUserRepository } from '../repositories/AuthUserRepository'
import { getCurrentUser, type SanitizedAuthUser } from './AuthService'

export interface AdminAccessParams {
  token: string | null
}

export interface AdminAccessResult {
  authorized: boolean
  user: SanitizedAuthUser | null
}

const DENIED: AdminAccessResult = { authorized: false, user: null }

export const resolveAdminAccess = async (
  params: AdminAccessParams,
  deps: { userRepository: AuthUserRepository },
): Promise<AdminAccessResult> => {
  let user: SanitizedAuthUser
  try {
    user = await getCurrentUser(params.token, { userRepository: deps.userRepository })
  } catch {
    return DENIED
  }

  if (!isAdmin(user.roles)) {
    return DENIED
  }

  return { authorized: true, user }
}
