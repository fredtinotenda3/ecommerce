// src/app/_utilities/getMeUser.ts
//
// PHASE 13A: when `USE_NATIVE_AUTH=true`, this now resolves the current
// user via the native session (`native-session` cookie + AuthService)
// instead of Payload's `/api/users/me` — see ../_api/meNative.ts's
// `getMeNative`. Default (flag off) behavior is byte-for-byte unchanged.
// This is a hard switch, not a fallback: with the flag on, only a valid
// native-session cookie resolves a user here — see
// docs/PHASE13A_REPORT.md's "Remaining Blockers" for why that means this
// branch won't yet see a user signed in via the frontend's Payload-only
// `AuthProvider`.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../../payload/payload-types'
import { isNativeAuthEnabled } from '../_api/authFlag'
import { getMeNative } from '../_api/meNative'
import { NATIVE_SESSION_COOKIE } from '../api/auth-native/_shared/respond'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  user: User
  token: string
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = cookies()

  let user: User | null = null
  let token = ''

  if (isNativeAuthEnabled()) {
    const nativeToken = cookieStore.get(NATIVE_SESSION_COOKIE)?.value ?? null
    const result = await getMeNative(nativeToken)
    user = result.user
    token = result.token
  } else {
    const payloadCookieToken = cookieStore.get('payload-token')?.value

    const serverURL = process.env.NEXT_PUBLIC_SERVER_URL
    if (!serverURL) {
      throw new Error('NEXT_PUBLIC_SERVER_URL environment variable is required')
    }

    const meUserReq = await fetch(`${serverURL}/api/users/me`, {
      headers: {
        Authorization: `JWT ${payloadCookieToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (meUserReq.ok) {
      const json = await meUserReq.json()
      user = json.user || null
    }

    token = payloadCookieToken || ''
  }

  if (validUserRedirect && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && !user) {
    redirect(nullUserRedirect)
  }

  return {
    user: user as User,
    token,
  }
}
