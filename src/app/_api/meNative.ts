// src/app/_api/meNative.ts
//
// PHASE 13A — native identity resolution, used by getMeUser.ts, getMe.ts,
// and getAuthenticatedPayloadUser.ts when `USE_NATIVE_AUTH=true`.
// Mirrors the fetchProductNative.ts split: `resolveMeNative` /
// `resolveAuthenticatedNativeUser` take repository INTERFACES (unit-
// testable with fakes — see tests/meNative.test.ts), and
// `getMeNative` / `getAuthenticatedNativeUser` supply the concrete
// Mongo-backed repositories for real callers.
//
// Session verification itself is unchanged from Phase 5:
// `AuthService.getCurrentUser` (src/lib/services/AuthService.ts) does
// the actual token verification against `AuthUserRepository`. This file
// only adds the additional step Phase 5 didn't need: mapping the result
// onto the full `payload-types.ts` `User` shape (via
// `userStorefrontAdapter.ts`) so storefront pages that expect that shape
// keep working unchanged.

import { getDbConnection } from '../../lib/db/connection'
import { toStorefrontUser } from '../../lib/repositories/adapters/userStorefrontAdapter'
import type { AuthUserRepository } from '../../lib/repositories/AuthUserRepository'
import { MongoAuthUserRepository } from '../../lib/repositories/AuthUserRepository'
import type { UserRepository } from '../../lib/repositories/UserRepository'
import { MongoUserRepository } from '../../lib/repositories/UserRepository'
import * as AuthService from '../../lib/services/AuthService'
import type { User as PayloadUser } from '../../payload/payload-types'

export interface MeNativeDeps {
  authUserRepository: AuthUserRepository
  userRepository: UserRepository
}

/** Verifies the native session token, then loads the FULL native user
 * (purchases/cart included — `AuthUserRepository` deliberately doesn't
 * carry those, see AuthUserRepository.ts's header comment) and maps it
 * onto the `User` shape `getMeUser`/`getMe` already return. Returns a
 * null user (never throws) for any invalid/expired/missing token, or if
 * the session's user no longer exists — matching the existing
 * Payload-backed helpers' "null user, don't throw" behavior for an
 * unauthenticated request. */
export const resolveMeNative = async (
  token: string | null,
  deps: MeNativeDeps,
): Promise<{ user: PayloadUser | null; token: string }> => {
  if (!token) return { user: null, token: '' }

  let sanitized: AuthService.SanitizedAuthUser
  try {
    sanitized = await AuthService.getCurrentUser(token, {
      userRepository: deps.authUserRepository,
    })
  } catch {
    return { user: null, token: '' }
  }

  const fullUser = await deps.userRepository.getById(sanitized.id)
  if (!fullUser) return { user: null, token: '' }

  return { user: toStorefrontUser(fullUser), token }
}

export const getMeNative = async (
  token: string | null,
): Promise<{ user: PayloadUser | null; token: string }> => {
  const connection = await getDbConnection()

  return resolveMeNative(token, {
    authUserRepository: new MongoAuthUserRepository(connection),
    userRepository: new MongoUserRepository(connection),
  })
}

/** Narrow id+email identity resolution for Route Handlers — mirrors
 * what `getAuthenticatedPayloadUser.ts` already returns for the Payload
 * path (deliberately not the full `User`, same "callers can't
 * accidentally use anything about the user's cart/purchases from a
 * source other than the database" rationale as that file). */
export const resolveAuthenticatedNativeUser = async (
  token: string | null,
  deps: { authUserRepository: AuthUserRepository },
): Promise<{ id: string; email: string } | null> => {
  if (!token) return null
  try {
    const user = await AuthService.getCurrentUser(token, {
      userRepository: deps.authUserRepository,
    })
    return { id: user.id, email: user.email }
  } catch {
    return null
  }
}

export const getAuthenticatedNativeUser = async (
  token: string | null,
): Promise<{ id: string; email: string } | null> => {
  const connection = await getDbConnection()

  return resolveAuthenticatedNativeUser(token, {
    authUserRepository: new MongoAuthUserRepository(connection),
  })
}
