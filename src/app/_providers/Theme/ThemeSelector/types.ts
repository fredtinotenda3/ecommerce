// src/app/_providers/Theme/ThemeSelector/types.ts
//
// Re-exported from the provider's `shared.ts` so the storage key and the
// default theme have exactly one definition. Two copies of a localStorage
// key is a bug waiting to happen: change one and the init script and the
// provider start reading different entries.

export { defaultTheme, themeLocalStorageKey } from '../shared'
export type { Theme } from '../types'
