// src/app/_providers/Auth/nativeAuthUser.ts
//
// PHASE 13B — pure mapper from the JSON shape `/api/auth-native/*`
// routes return (`SanitizedAuthUser`, see src/lib/services/AuthService.ts)
// onto the `payload-types.ts` `User` shape the frontend's `AuthProvider`
// and everything downstream of it (`useAuth().user`) already expects.
//
// This is deliberately a SEPARATE, smaller mapper from
// `userStorefrontAdapter.ts`'s `toStorefrontUser`, not a reuse of it:
// `toStorefrontUser` maps a full native domain `User`
// (src/lib/domain/types.ts, with real `cart`/`purchases`/timestamps
// loaded from the DB) and lives under `src/lib` alongside repository
// code that imports Mongoose — importing it here would pull
// server/DB-only code into a `'use client'` bundle. The six
// `/api/auth-native/*` routes only ever return `SanitizedAuthUser`
// (id/email/name/roles — see AuthService.ts's `sanitize`), which never
// carries cart/purchases/timestamps at all, so there is nothing for a
// richer mapper to read here even if it could import one.
//
// Known, documented difference from the Payload path: `cart`/`purchases`
// come back empty and `updatedAt`/`createdAt` come back as `''`, because
// the native auth endpoints this mapper receives data from don't return
// that information. See the Phase 13b report's "Differences from
// Payload behavior" / "Remaining Risks" for why, and
// src/app/_api/meNative.ts's `resolveMeNative` (used server-side by
// `getMe`/`getMeUser`, unaffected by this file) for the path that DOES
// have full cart/purchases via `toStorefrontUser`.
//
// Pure function, no I/O — safe to unit test without a DOM/fetch.

import type { User as StorefrontUser } from '../../../payload/payload-types'

/** Mirrors `SanitizedAuthUser` (src/lib/services/AuthService.ts)
 * structurally. Not imported from there directly: that module lives
 * under `src/lib/services` and pulls in `crypto`-based session/password
 * helpers that are server-only, and this file must stay importable from
 * a `'use client'` component. */
export interface NativeAuthUser {
  id: string
  email: string
  name: string | null
  roles: Array<'admin' | 'customer'>
}

export const mapNativeAuthUserToStorefrontUser = (nativeUser: NativeAuthUser): StorefrontUser => ({
  id: nativeUser.id,
  name: nativeUser.name ?? undefined,
  email: nativeUser.email,
  roles: nativeUser.roles,
  purchases: [],
  cart: { items: [] },
  updatedAt: '',
  createdAt: '',
  password: '',
})
