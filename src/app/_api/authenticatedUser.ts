// src/app/_api/authenticatedUser.ts
//
// Resolves the caller of a Route Handler from the `native-session` cookie.
//
// Server components use `getMeUser` (src/app/_utilities/getMeUser.ts),
// which can `redirect()`. Route handlers cannot, so this returns `null`
// for "not authenticated" and lets the handler choose the status code.

import { cookies, headers } from 'next/headers'

import { SESSION_COOKIE } from '../api/auth/_shared/respond'
import { resolveAuthenticatedUser } from './me'
import { getRepositories } from './repositories'

export interface AuthenticatedUser {
  id: string
  email: string
}

/** Cookie first, falling back to `Authorization: Bearer <token>` so the
 * API can be exercised without a browser. Both carry the same signed
 * session token; neither is trusted beyond what `verifySessionToken`
 * proves. */
export const extractSessionToken = (): string | null => {
  const authHeader = headers().get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim()
  }
  return cookies().get(SESSION_COOKIE)?.value ?? null
}

export const getAuthenticatedUser = async (): Promise<AuthenticatedUser | null> => {
  const { authUsers } = await getRepositories()
  return resolveAuthenticatedUser(extractSessionToken(), { authUserRepository: authUsers })
}
