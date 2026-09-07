// src/app/_utilities/getMeUser.ts
//
// Resolves the current user inside a Server Component, with the redirect
// behaviour pages rely on. Route handlers use `getAuthenticatedUser`
// (src/app/_api/authenticatedUser.ts) instead, since `redirect()` is not
// available to them.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { SESSION_COOKIE } from '../api/auth/_shared/respond'
import { getMe } from '../_api/me'
import type { StorefrontUser } from '../_types/storefront'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  user: StorefrontUser
  token: string
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}

  const token = cookies().get(SESSION_COOKIE)?.value ?? null
  const { user, token: sessionToken } = await getMe(token)

  if (validUserRedirect && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && !user) {
    redirect(nullUserRedirect)
  }

  return { user: user as StorefrontUser, token: sessionToken }
}
