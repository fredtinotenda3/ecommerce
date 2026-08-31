'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { User } from '../../../payload/payload-types'
import { mapNativeAuthUserToStorefrontUser, NativeAuthUser } from './nativeAuthUser'

// eslint-disable-next-line no-unused-vars
type ResetPassword = (args: {
  password: string
  passwordConfirm?: string
  token: string
}) => Promise<void>

type ForgotPassword = (args: { email: string }) => Promise<void> // eslint-disable-line no-unused-vars

type Create = (args: {
  email: string
  password: string
  passwordConfirm?: string
  name?: string
}) => Promise<void> // eslint-disable-line no-unused-vars

type Login = (args: { email: string; password: string }) => Promise<User> // eslint-disable-line no-unused-vars

type Logout = () => Promise<void>

type AuthContext = {
  user?: User | null
  setUser: (user: User | null) => void // eslint-disable-line no-unused-vars
  logout: Logout
  login: Login
  create: Create
  resetPassword: ResetPassword
  forgotPassword: ForgotPassword
  status: undefined | 'loggedOut' | 'loggedIn'
  /** PHASE 13B: exposes the resolved auth mode to consumers (e.g. pages
   * that call `fetch` directly instead of going through `login`/`create`
   * above) so they can branch to the matching endpoint. Mirrors the
   * `nativeAuthEnabled` prop this same value is threaded down from. */
  nativeAuthEnabled: boolean
}

const Context = createContext({} as AuthContext)

/** Native auth JSON responses ({@link NativeAuthUser}) come back on this
 * shape from all six `/api/auth-native/*` routes on success — see
 * src/app/api/auth-native/*\/route.ts. */
type NativeAuthResponseBody = {
  user?: NativeAuthUser
  error?: string
}

const NATIVE_AUTH_HEADERS = { 'Content-Type': 'application/json' } as const

export const AuthProvider: React.FC<{
  children: React.ReactNode
  /** PHASE 13B: when true (`USE_NATIVE_AUTH=true`, resolved server-side
   * in layout.tsx via `resolveAuthMode()` and passed down as a prop,
   * since this is a client component and the flag itself is not
   * `NEXT_PUBLIC_`-prefixed — same pattern as `AdminBar`'s
   * `nativeAdminEnabled` in Phase 13a), every method below calls the
   * `/api/auth-native/*` routes and reads/writes the `native-session`
   * cookie instead of Payload's `/api/users/*` + `payload-token`.
   * Defaults to false, so omitting this prop preserves the exact
   * pre-Phase-13b (Payload-only) behavior byte-for-byte. */
  nativeAuthEnabled?: boolean
}> = ({ children, nativeAuthEnabled = false }) => {
  const [user, setUser] = useState<User | null>()

  // used to track the single event of logging in or logging out
  // useful for `useEffect` hooks that should only run once
  const [status, setStatus] = useState<undefined | 'loggedOut' | 'loggedIn'>()

  const create = useCallback<Create>(
    async args => {
      if (nativeAuthEnabled) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth-native/register`, {
            method: 'POST',
            credentials: 'include',
            headers: NATIVE_AUTH_HEADERS,
            body: JSON.stringify({
              email: args.email,
              password: args.password,
              name: args.name ?? null,
            }),
          })

          const body: NativeAuthResponseBody = await res.json()
          if (!res.ok || !body.user) throw new Error(body.error || 'Invalid registration')

          // Native `/register` already issues a session and sets the
          // `native-session` cookie (see the route's header comment) —
          // unlike Payload's `/api/users` create, there is no separate
          // login step needed here.
          setUser(mapNativeAuthUserToStorefrontUser(body.user))
          setStatus('loggedIn')
        } catch (e) {
          throw new Error('An error occurred while attempting to login.')
        }
        return
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/create`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: args.email,
            password: args.password,
            passwordConfirm: args.passwordConfirm,
          }),
        })

        if (res.ok) {
          const { data, errors } = await res.json()
          if (errors) throw new Error(errors[0].message)
          setUser(data?.loginUser?.user)
          setStatus('loggedIn')
        } else {
          throw new Error('Invalid login')
        }
      } catch (e) {
        throw new Error('An error occurred while attempting to login.')
      }
    },
    [nativeAuthEnabled],
  )

  const login = useCallback<Login>(
    async args => {
      if (nativeAuthEnabled) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth-native/login`, {
            method: 'POST',
            credentials: 'include',
            headers: NATIVE_AUTH_HEADERS,
            body: JSON.stringify({
              email: args.email,
              password: args.password,
            }),
          })

          const body: NativeAuthResponseBody = await res.json()
          if (!res.ok || !body.user) throw new Error(body.error || 'Invalid login')

          const mappedUser = mapNativeAuthUserToStorefrontUser(body.user)
          setUser(mappedUser)
          setStatus('loggedIn')
          return mappedUser
        } catch (e) {
          throw new Error('An error occurred while attempting to login.')
        }
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/login`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: args.email,
            password: args.password,
          }),
        })

        if (res.ok) {
          const { user: loggedInUser, errors } = await res.json()
          if (errors) throw new Error(errors[0].message)
          setUser(loggedInUser)
          setStatus('loggedIn')
          return loggedInUser
        }

        throw new Error('Invalid login')
      } catch (e) {
        throw new Error('An error occurred while attempting to login.')
      }
    },
    [nativeAuthEnabled],
  )

  const logout = useCallback<Logout>(async () => {
    if (nativeAuthEnabled) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth-native/logout`, {
          method: 'POST',
          credentials: 'include',
          headers: NATIVE_AUTH_HEADERS,
        })

        if (res.ok) {
          setUser(null)
          setStatus('loggedOut')
        } else {
          throw new Error('An error occurred while attempting to logout.')
        }
      } catch (e) {
        throw new Error('An error occurred while attempting to logout.')
      }
      return
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        setUser(null)
        setStatus('loggedOut')
      } else {
        throw new Error('An error occurred while attempting to logout.')
      }
    } catch (e) {
      throw new Error('An error occurred while attempting to logout.')
    }
  }, [nativeAuthEnabled])

  useEffect(() => {
    const fetchMeNative = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth-native/me`, {
          method: 'GET',
          credentials: 'include',
          headers: NATIVE_AUTH_HEADERS,
        })

        if (res.ok) {
          const body: NativeAuthResponseBody = await res.json()
          const mappedUser = body.user ? mapNativeAuthUserToStorefrontUser(body.user) : null
          setUser(mappedUser)
          setStatus(mappedUser ? 'loggedIn' : undefined)
        } else {
          // 401 (no/expired session) is the expected steady state for a
          // logged-out visitor, not an error — mirrors the Payload path
          // below treating a non-ok `/api/users/me` as "no user" too.
          setUser(null)
        }
      } catch (e) {
        setUser(null)
      }
    }

    const fetchMePayload = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/me`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (res.ok) {
          const { user: meUser } = await res.json()
          setUser(meUser || null)
          setStatus(meUser ? 'loggedIn' : undefined)
        } else {
          throw new Error('An error occurred while fetching your account.')
        }
      } catch (e) {
        setUser(null)
        throw new Error('An error occurred while fetching your account.')
      }
    }

    if (nativeAuthEnabled) {
      fetchMeNative()
    } else {
      fetchMePayload()
    }
  }, [nativeAuthEnabled])

  const forgotPassword = useCallback<ForgotPassword>(
    async args => {
      if (nativeAuthEnabled) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth-native/forgot-password`,
            {
              method: 'POST',
              credentials: 'include',
              headers: NATIVE_AUTH_HEADERS,
              body: JSON.stringify({
                email: args.email,
              }),
            },
          )

          if (!res.ok) throw new Error('Invalid login')
        } catch (e) {
          throw new Error('An error occurred while attempting to login.')
        }
        return
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/forgot-password`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: args.email,
          }),
        })

        if (res.ok) {
          const { data, errors } = await res.json()
          if (errors) throw new Error(errors[0].message)
          setUser(data?.loginUser?.user)
        } else {
          throw new Error('Invalid login')
        }
      } catch (e) {
        throw new Error('An error occurred while attempting to login.')
      }
    },
    [nativeAuthEnabled],
  )

  const resetPassword = useCallback<ResetPassword>(
    async args => {
      if (nativeAuthEnabled) {
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/auth-native/reset-password`,
            {
              method: 'POST',
              credentials: 'include',
              headers: NATIVE_AUTH_HEADERS,
              body: JSON.stringify({
                password: args.password,
                token: args.token,
              }),
            },
          )

          const body: NativeAuthResponseBody = await res.json()
          if (!res.ok || !body.user) throw new Error(body.error || 'Invalid login')

          const mappedUser = mapNativeAuthUserToStorefrontUser(body.user)
          setUser(mappedUser)
          setStatus('loggedIn')
        } catch (e) {
          throw new Error('An error occurred while attempting to login.')
        }
        return
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/users/reset-password`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            password: args.password,
            passwordConfirm: args.passwordConfirm,
            token: args.token,
          }),
        })

        if (res.ok) {
          const { data, errors } = await res.json()
          if (errors) throw new Error(errors[0].message)
          setUser(data?.loginUser?.user)
          setStatus(data?.loginUser?.user ? 'loggedIn' : undefined)
        } else {
          throw new Error('Invalid login')
        }
      } catch (e) {
        throw new Error('An error occurred while attempting to login.')
      }
    },
    [nativeAuthEnabled],
  )

  return (
    <Context.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        create,
        resetPassword,
        forgotPassword,
        status,
        nativeAuthEnabled,
      }}
    >
      {children}
    </Context.Provider>
  )
}

type UseAuth<T = User> = () => AuthContext // eslint-disable-line no-unused-vars

export const useAuth: UseAuth = () => useContext(Context)
