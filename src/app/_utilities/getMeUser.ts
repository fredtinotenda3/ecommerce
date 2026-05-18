import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../../payload/payload-types'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  user: User
  token: string
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}
  const cookieStore = cookies()
  const token = cookieStore.get('payload-token')?.value

  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL
  if (!serverURL) {
    throw new Error('NEXT_PUBLIC_SERVER_URL environment variable is required')
  }

  const meUserReq = await fetch(`${serverURL}/api/users/me`, {
    headers: {
      Authorization: `JWT ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  let user: User | null = null

  if (meUserReq.ok) {
    const json = await meUserReq.json()
    user = json.user || null
  }

  if (validUserRedirect && user) {
    redirect(validUserRedirect)
  }

  if (nullUserRedirect && !user) {
    redirect(nullUserRedirect)
  }

  return {
    user: user as User,
    token: token || '',
  }
}
