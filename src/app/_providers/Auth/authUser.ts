// src/app/_providers/Auth/authUser.ts
//
// Maps the JSON shape the /api/auth/* routes return (`SanitizedAuthUser`,
// see src/lib/services/AuthService.ts) onto the `StorefrontUser` view model
// the client-side `AuthProvider` exposes.
//
// This is deliberately separate from `userStorefrontAdapter.ts`: that one
// maps a full domain `User` and lives under `src/lib` next to repository
// code that imports Mongoose, which must never be pulled into a client
// bundle. The auth routes only ever return id/email/name/roles anyway.
//
// Known, documented gap: `cart`/`purchases` come back empty and the
// timestamps blank, because the auth endpoints do not return them. The
// cart is rehydrated separately by `CartProvider`, and pages that need
// purchases resolve the user server-side through `getMeUser`, which reads
// the full record.
//
// Pure function, no I/O.

import type { StorefrontUser } from '../../_types/storefront'

/** Mirrors `SanitizedAuthUser` structurally. Not imported from
 * AuthService: that module pulls in crypto-based session/password helpers
 * that are server-only, and this file must stay importable from a
 * `'use client'` component. */
export interface AuthUser {
  id: string
  email: string
  name: string | null
  roles: Array<'admin' | 'customer'>
}

export const mapAuthUserToStorefrontUser = (user: AuthUser): StorefrontUser => ({
  id: user.id,
  name: user.name ?? null,
  email: user.email,
  roles: user.roles,
  purchases: [],
  cart: { items: [] },
  updatedAt: '',
  createdAt: '',
})
