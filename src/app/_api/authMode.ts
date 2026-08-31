// src/app/_api/authMode.ts
//
// PHASE 13B — small resolver on top of `isNativeAuthEnabled()`
// (authFlag.ts, PHASE 5) for the new caller this phase adds: the
// server-only root layout, which needs to decide what to hand the
// client `AuthProvider` as a plain boolean prop. The flag itself
// (`USE_NATIVE_AUTH`) is deliberately not `NEXT_PUBLIC_`-prefixed (see
// authFlag.ts's own header comment), so a `'use client'` component has
// no way to read it directly — same rationale, and same pattern, as
// `isNativeAdminEnabled()` / `nativeAdminEnabled` for `AdminBar` in
// Phase 13a's layout.tsx change.
//
// Returns a semantic string union rather than the raw boolean so call
// sites read as intent (`resolveAuthMode() === 'native'`) instead of a
// bare flag name that could be confused with any of authFlag.ts's
// sibling flags (USE_NATIVE_ADMIN, USE_NATIVE_REPOSITORY, ...).
//
// Deliberately does not replace `isNativeAuthEnabled()` anywhere it's
// already used (route guards, getMe.ts, etc.) — those keep reading the
// boolean directly, unchanged. This is additive, for the one new
// call site.

import { isNativeAuthEnabled } from './authFlag'

export type AuthMode = 'payload' | 'native'

export const resolveAuthMode = (): AuthMode => (isNativeAuthEnabled() ? 'native' : 'payload')
