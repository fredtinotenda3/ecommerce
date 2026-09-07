'use client'

// src/app/_providers/Auth/index.tsx
//
// Client-side session state, backed by the /api/auth/* routes.
//
// The session itself lives in an httpOnly cookie the browser sends
// automatically (`credentials: 'include'`); nothing here reads or stores a
// token, so a script injected into the page cannot exfiltrate one. The user
// object held in state is a convenience for rendering — every
// authorization decision is made server-side, per request.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

import type { StorefrontUser } from '../../_types/storefront'
import { type AuthUser, mapAuthUserToStorefrontUser } from './authUser'

type ResetPassword = (args: {
  password: string
  passwordConfirm?: string
  token: string
}) => Promise<void>

type ForgotPassword = (args: { email: string }) => Promise<void>

type Create = (args: {
  email: string
  password: string
  passwordConfirm?: string
  name?: string
}) => Promise<void>

type Login = (args: { email: string; password: string }) => Promise<StorefrontUser>

type Logout = () => Promise<void>

type AuthContext = {
  user?: StorefrontUser | null
  setUser: (user: StorefrontUser | null) => void
  logout: Logout
  login: Login
  create: Create
  resetPassword: ResetPassword
  forgotPassword: ForgotPassword
  status: undefined | 'loggedOut' | 'loggedIn'
}

const Context = createContext({} as AuthContext)

/** Every /api/auth/* route responds on this shape. */
type AuthResponseBody = {
  user?: AuthUser
  error?: string
}

const AUTH_HEADERS = { 'Content-Type': 'application/json' } as const

/** Relative URLs keep every auth request same-origin, so the session cookie
 * is sent and no absolute origin needs to be configured for the client. */
const authUrl = (path: string): string => `/api/auth/${path}`

/** The auth routes only ever return deliberately non-specific messages, so
 * showing the server's own text is safe; anything else falls back to a
 * generic string rather than surfacing a transport-level detail. */
const readError = (body: AuthResponseBody | null, fallback: string): string =>
  typeof body?.error === 'string' && body.error ? body.error : fallback

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StorefrontUser | null>()

  // Tracks the single event of logging in or out, for effects that should
  // run once per transition rather than on every user object change.
  const [status, setStatus] = useState<undefined | 'loggedOut' | 'loggedIn'>()

  const create = useCallback<Create>(async args => {
    const res = await fetch(authUrl('register'), {
      method: 'POST',
      credentials: 'include',
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        email: args.email,
        password: args.password,
        name: args.name ?? null,
      }),
    })

    const body: AuthResponseBody | null = await res.json().catch(() => null)
    if (!res.ok || !body?.user) {
      throw new Error(readError(body, 'Unable to create your account.'))
    }

    // Registration issues the session in the same request, so there is no
    // separate login round trip here.
    setUser(mapAuthUserToStorefrontUser(body.user))
    setStatus('loggedIn')
  }, [])

  const login = useCallback<Login>(async args => {
    const res = await fetch(authUrl('login'), {
      method: 'POST',
      credentials: 'include',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ email: args.email, password: args.password }),
    })

    const body: AuthResponseBody | null = await res.json().catch(() => null)
    if (!res.ok || !body?.user) {
      throw new Error(readError(body, 'Invalid login.'))
    }

    const mappedUser = mapAuthUserToStorefrontUser(body.user)
    setUser(mappedUser)
    setStatus('loggedIn')
    return mappedUser
  }, [])

  const logout = useCallback<Logout>(async () => {
    const res = await fetch(authUrl('logout'), {
      method: 'POST',
      credentials: 'include',
      headers: AUTH_HEADERS,
    })

    if (!res.ok) {
      throw new Error('An error occurred while attempting to logout.')
    }

    setUser(null)
    setStatus('loggedOut')
  }, [])

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch(authUrl('me'), {
          method: 'GET',
          credentials: 'include',
          headers: AUTH_HEADERS,
        })

        if (!res.ok) {
          // 401 is the expected steady state for a logged-out visitor, not
          // an error worth surfacing.
          setUser(null)
          return
        }

        const body: AuthResponseBody | null = await res.json().catch(() => null)
        const mappedUser = body?.user ? mapAuthUserToStorefrontUser(body.user) : null
        setUser(mappedUser)
        setStatus(mappedUser ? 'loggedIn' : undefined)
      } catch (e) {
        setUser(null)
      }
    }

    fetchMe()
  }, [])

  const forgotPassword = useCallback<ForgotPassword>(async args => {
    const res = await fetch(authUrl('forgot-password'), {
      method: 'POST',
      credentials: 'include',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ email: args.email }),
    })

    if (!res.ok) {
      throw new Error('An error occurred while requesting a password reset.')
    }
  }, [])

  const resetPassword = useCallback<ResetPassword>(async args => {
    const res = await fetch(authUrl('reset-password'), {
      method: 'POST',
      credentials: 'include',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ password: args.password, token: args.token }),
    })

    const body: AuthResponseBody | null = await res.json().catch(() => null)
    if (!res.ok || !body?.user) {
      throw new Error(readError(body, 'Unable to reset your password.'))
    }

    setUser(mapAuthUserToStorefrontUser(body.user))
    setStatus('loggedIn')
  }, [])

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
      }}
    >
      {children}
    </Context.Provider>
  )
}

export const useAuth = (): AuthContext => useContext(Context)
