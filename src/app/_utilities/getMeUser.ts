import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { User } from '../../payload/payload-types'

export const getMeUser = async (args?: {
  nullUserRedirect?: string
  validUserRedirect?: string
}): Promise<{
  user: User | null
  token: string | null
}> => {
  const { nullUserRedirect, validUserRedirect } = args || {}

  const cookieStore = cookies()

  const token = cookieStore.get('payload-token')?.value

  if (!token) {
    if (nullUserRedirect) {
      redirect(nullUserRedirect)
    }

    return {
      user: null,
      token: null,
    }
  }

  try {
    const meUserReq = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/me`, {
      headers: {
        Authorization: `JWT ${token}`,
      },
      cache: 'no-store',
    })

    if (!meUserReq.ok) {
      throw new Error('Failed to fetch user')
    }

    const data = await meUserReq.json()

    const user = data?.user || null

    if (validUserRedirect && user) {
      redirect(validUserRedirect)
    }

    if (nullUserRedirect && !user) {
      redirect(nullUserRedirect)
    }

    return {
      user,
      token,
    }
  } catch (error: unknown) {
    console.error(error)

    if (nullUserRedirect) {
      redirect(nullUserRedirect)
    }

    return {
      user: null,
      token: null,
    }
  }
}
