// src/app/_api/me.ts
//
// Identity resolution for server components and route handlers.
//
// `AuthService.getCurrentUser` verifies the session token against the
// auth-user record; this module adds the step that verification alone does
// not do — loading the full user (cart and purchases included) and mapping
// it onto the storefront's `StorefrontUser` view model.
//
// The `resolve*` functions take repository INTERFACES so they can be unit
// tested with fakes; the `get*` wrappers supply the real repositories.

import { toStorefrontUser } from '../../lib/repositories/adapters/userStorefrontAdapter'
import type { AuthUserRepository } from '../../lib/repositories/AuthUserRepository'
import type { UserRepository } from '../../lib/repositories/UserRepository'
import * as AuthService from '../../lib/services/AuthService'
import type { StorefrontUser } from '../_types/storefront'
import { getRepositories } from './repositories'

export interface MeDeps {
  authUserRepository: AuthUserRepository
  userRepository: UserRepository
}

/** Returns a null user (never throws) for any missing, invalid or expired
 * token, and for a session whose user no longer exists. Callers decide how
 * to respond — typically a redirect for pages, 401 for route handlers. */
export const resolveMe = async (
  token: string | null,
  deps: MeDeps,
): Promise<{ user: StorefrontUser | null; token: string }> => {
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

export const getMe = async (
  token: string | null,
): Promise<{ user: StorefrontUser | null; token: string }> => {
  const { authUsers, users } = await getRepositories()
  return resolveMe(token, { authUserRepository: authUsers, userRepository: users })
}

/** Narrow id + email identity for route handlers. Deliberately not the
 * full user: a handler must never make an authorization or pricing
 * decision from a cart or purchase list carried in the session rather than
 * read fresh from the database. */
export const resolveAuthenticatedUser = async (
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
