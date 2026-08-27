// src/app/_api/authFlag.ts
//
// PHASE 5 flag: gates the parallel, native `/api/auth-native/*` routes.
// Separate from `USE_NATIVE_REPOSITORY` (dataSource.ts) — a deployment
// could have native storefront reads on without native auth routes
// exposed at all, or vice versa.
//
// Default (flag unset/false): all `/api/auth-native/*` routes respond
// 404, as if they don't exist — see the Phase 5 report for why 404 (not
// 405) was chosen. Payload's own `/api/users/*` auth is completely
// unaffected either way; the frontend does not call these routes yet.
//
// Deliberately a single tiny helper (not a config object), same
// rationale as isNativeRepositoryEnabled in dataSource.ts.
export const isNativeAuthEnabled = (): boolean => process.env.USE_NATIVE_AUTH === 'true'
