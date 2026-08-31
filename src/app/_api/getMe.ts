// src/app/_api/getMe.ts
//
// Note: as of Phase 13a this remains unreferenced by any page/route in
// the app (getMeUser.ts's REST-based helper is what's actually used) —
// confirmed by search during Phase 13a's audit. Updated anyway per the
// Phase 13a task's explicit file list, so it doesn't silently drift out
// of sync with getMeUser.ts's native-auth behavior if something starts
// importing it later.
//
// PHASE 13A: when `USE_NATIVE_AUTH=true`, this now resolves the current
// user via the native session instead of Payload's GraphQL `ME_QUERY` —
// see ../_api/meNative.ts's `getMeNative`. Default (flag off) behavior
// is unchanged.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../../payload/payload-types'
import { ME_QUERY } from '../_graphql/me'
import { NATIVE_SESSION_COOKIE } from '../api/auth-native/_shared/respond'
import { isNativeAuthEnabled } from './authFlag'
import { getMeNative } from './meNative'
import { GRAPHQL_API_URL } from './shared'

export const getMe = async (args?: {
  nullUserRedirect?: string
  userRedirect?: string
}): Promise<{
  user: User
  token: string
}> => {
  const { nullUserRedirect, userRedirect } = args || {}
  const cookieStore = cookies()

  let user: User
  let token: string

  if (isNativeAuthEnabled()) {
    const nativeToken = cookieStore.get(NATIVE_SESSION_COOKIE)?.value ?? null
    const result = await getMeNative(nativeToken)
    user = result.user as User
    token = result.token

    if (userRedirect && user) {
      redirect(userRedirect)
    }

    if (nullUserRedirect && !user) {
      redirect(nullUserRedirect)
    }

    return { user, token }
  }

  const payloadCookieToken = cookieStore.get('payload-token')?.value

  const meUserReq = await fetch(`${GRAPHQL_API_URL}/api/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `JWT ${payloadCookieToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      query: ME_QUERY,
    }),
  })

  const {
    user: graphqlUser,
  }: {
    user: User
  } = await meUserReq.json()

  if (userRedirect && meUserReq.ok && graphqlUser) {
    redirect(userRedirect)
  }

  if (nullUserRedirect && (!meUserReq.ok || !graphqlUser)) {
    redirect(nullUserRedirect)
  }

  return {
    user: graphqlUser,
    token: payloadCookieToken,
  }
}
