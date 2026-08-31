// src/app/_api/serverFlag.ts
//
// PHASE 13A flag: gates which boot path `src/server.ts` delegates to.
//
// Default (flag unset/false): `src/server.ts` calls `startPayloadServer()`
// (src/server.payload.ts) — the existing Payload+Express+Next.js path,
// unchanged.
// USE_NATIVE_SERVER=true: `src/server.ts` calls `startNativeServer()`
// (src/server.native.ts) instead — a plain Next.js boot that never
// imports or initializes Payload.
//
// Separate from `USE_NATIVE_REPOSITORY`/`USE_NATIVE_AUTH`/
// `USE_NATIVE_ADMIN` — this flag only controls the *process bootstrap*,
// not which data/auth path individual requests use. In practice it is
// only meaningful today alongside `USE_NATIVE_REPOSITORY=true` (see
// server.native.ts's header comment), but is intentionally its own flag
// so the two concerns stay independently toggleable and testable.
//
// Deliberately a single tiny helper (not a config object), same
// rationale as isNativeRepositoryEnabled/isNativeAuthEnabled/
// isNativeAdminEnabled.
export const isNativeServerEnabled = (): boolean => process.env.USE_NATIVE_SERVER === 'true'
