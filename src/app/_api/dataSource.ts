// src/app/_api/dataSource.ts
//
// PHASE 2 flag: gates the parallel, read-only native repository data path.
//
// Default (flag unset/false): existing GraphQL fetchDoc/fetchDocs path.
// USE_NATIVE_REPOSITORY=true: native repository path for the specific
// storefront reads that have been migrated so far (see fetchCategoriesNative.ts).
//
// Deliberately a single tiny helper (not a config object) so call sites read
// the same source of truth and grep/search stays simple.
export const isNativeRepositoryEnabled = (): boolean => process.env.USE_NATIVE_REPOSITORY === 'true'
