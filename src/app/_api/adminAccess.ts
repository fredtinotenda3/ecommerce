// src/app/_api/adminAccess.ts
//
// PHASE 6 — DB + request-wired entry point for native admin
// authorization. Mirrors the fetchProductNative.ts / authNative.ts
// split: `AdminAccessService.ts` takes a repository interface for unit
// testing, and this file supplies the concrete `MongoAuthUserRepository`
// plus reads the actual cookie/Authorization header for real requests.
//
// Used exclusively by the native-admin route group's layout
// (src/app/(native-admin)/native-admin/layout.tsx). Never imported by
// any storefront/checkout/Payload code path.

import { cookies, headers } from 'next/headers'

import { getDbConnection } from '../../lib/db/connection'
import { MongoAuthUserRepository } from '../../lib/repositories/AuthUserRepository'
import { type AdminAccessResult, resolveAdminAccess } from '../../lib/services/AdminAccessService'
import { NATIVE_SESSION_COOKIE } from '../api/auth-native/_shared/respond'
import { isNativeAdminEnabled } from './adminFlag'
import { isNativeAuthEnabled } from './authFlag'

/** Same "cookie, falling back to Authorization: Bearer" extraction as
 * `GET /api/auth-native/me` (src/app/api/auth-native/me/route.ts),
 * duplicated rather than imported since that logic is tied to a
 * `NextRequest`, not the `headers()`/`cookies()` server-component APIs
 * used here. */
const extractToken = (): string | null => {
  const authHeader = headers().get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  return cookies().get(NATIVE_SESSION_COOKIE)?.value ?? null
}

export const getNativeAdminAccess = async (): Promise<AdminAccessResult> => {
  const nativeAdminEnabled = isNativeAdminEnabled()
  const nativeAuthEnabled = isNativeAuthEnabled()

  // Short-circuit before touching cookies/DB when either flag is off —
  // keeps the common (disabled) path cheap and side-effect-free.
  if (!nativeAdminEnabled || !nativeAuthEnabled) {
    return { authorized: false, user: null }
  }

  const token = extractToken()
  const connection = await getDbConnection()
  const userRepository = new MongoAuthUserRepository(connection)

  return resolveAdminAccess({ nativeAdminEnabled, nativeAuthEnabled, token }, { userRepository })
}
