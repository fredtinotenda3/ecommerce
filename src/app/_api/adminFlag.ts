// src/app/_api/adminFlag.ts
//
// PHASE 6 flag: gates the parallel, native `/native-admin/*` route group.
//
// Separate from `USE_NATIVE_REPOSITORY` (dataSource.ts) and
// `USE_NATIVE_AUTH` (authFlag.ts) — a deployment could have native
// storefront reads and/or native auth routes on without the native admin
// area exposed at all, or vice versa. Native admin additionally requires
// `USE_NATIVE_AUTH=true` at runtime (see adminAccess.ts) since it
// authorizes requests via the native session/AuthService, but that
// dependency is expressed in adminAccess.ts, not baked into this flag.
//
// Default (flag unset/false): every `/native-admin/*` route responds as
// if it doesn't exist (404) — see the native-admin layout, which mirrors
// the 404-over-401 rationale from the Phase 5 report.
//
// Deliberately a single tiny helper (not a config object), same
// rationale as isNativeRepositoryEnabled/isNativeAuthEnabled.
export const isNativeAdminEnabled = (): boolean => process.env.USE_NATIVE_ADMIN === 'true'
