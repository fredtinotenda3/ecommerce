// src/lib/services/AdminAccessService.ts
//
// PHASE 6 — pure authorization-decision logic for the native admin area.
// Orchestration only (mirrors AuthService.ts and the fetchXNative.ts /
// buildStorefrontX split): takes an `AuthUserRepository` INTERFACE, not a
// concrete Mongo class, so it's unit-testable with
// `tests/fakes/FakeAuthUserRepository.ts` and no database. DB + cookie/
// header wiring lives in `src/app/_api/adminAccess.ts`.
//
// Access rule (per the Phase 6 task):
//   USE_NATIVE_ADMIN=true AND USE_NATIVE_AUTH=true AND a valid
//   native-session token AND the resolved user has role 'admin'.
// Any other case is "not authorized" — the caller (adminAccess.ts /
// the native-admin layout) is responsible for turning that into a 404,
// never a 401/403, so the admin area's existence isn't confirmed to an
// unauthorized caller (same rationale as guardNativeAuthEnabled in
// src/app/api/auth-native/_shared/respond.ts).

import { isAdmin } from '../auth/roles'
import type { AuthUserRepository } from '../repositories/AuthUserRepository'
import { getCurrentUser, type SanitizedAuthUser } from './AuthService'

export interface AdminAccessParams {
  nativeAdminEnabled: boolean
  nativeAuthEnabled: boolean
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
  if (!params.nativeAdminEnabled || !params.nativeAuthEnabled) {
    return DENIED
  }

  let user: SanitizedAuthUser
  try {
    user = await getCurrentUser(params.token, { userRepository: deps.userRepository })
  } catch {
    // Invalid/expired/missing token, or the token refers to a user that
    // no longer exists — all treated identically as "not authorized".
    return DENIED
  }

  if (!isAdmin(user.roles)) {
    return DENIED
  }

  return { authorized: true, user }
}
