// src/app/_components/AdminBar/shouldShowAdminBar.ts
//
// PHASE 13A — extracted as a pure function so AdminBar's flag behavior
// is unit-testable without a React rendering environment (this repo has
// no React component-testing setup, and Phase 13a's instructions say
// not to add new dependencies unless absolutely necessary — see
// tests/shouldShowAdminBar.test.ts).
//
// `AdminBar` (index.tsx) still links directly into Payload's own admin
// panel (`PayloadAdminBar`'s `cmsURL`). `/native-admin` (Phase 6) is
// read-only and has no per-document deep-link equivalent, so this is a
// "hide, don't repoint" per the Phase 13a task's own fallback
// instruction ("If AdminBar cannot be cleanly repointed, hide it when
// native admin flag is on").
export const shouldShowAdminBar = (params: {
  nativeAdminEnabled: boolean
  isAdmin: boolean
}): boolean => {
  if (params.nativeAdminEnabled) return false
  return params.isAdmin
}
