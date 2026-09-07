# CategoryCard Null-Media Fix Report

## Bug
`src/app/_components/Categories/CategoryCard/index.tsx` cast `category.media` straight to `Media` and read `media.url` unconditionally. When a seeded `Category.media` is `null` (or left as an unpopulated relationship id string), this threw:
`TypeError: Cannot read properties of null (reading 'url')`
— identically under both `USE_NATIVE_REPOSITORY=false` and `=true`, since both paths pass whatever `category.media` actually is straight through to this component. Unrelated to the migration itself.

The file also had a pre-existing TS error: `Cannot find name 'Media'` — the `Media` type was used but never imported.

## Fix
`src/app/_components/Categories/CategoryCard/index.tsx`:
- Imported `Media` alongside `Category` from `../../../../payload/payload-types` (fixes the `Cannot find name 'Media'` typecheck error).
- `category.media` is now typed as `Media | string | null | undefined` (matching the real `Category.media?: string | Media` shape from `payload-types.ts`), instead of being force-cast to `Media`.
- Derived `mediaUrl` safely: only reads `.url` when `media` is a populated object (`typeof media === 'object'`), yielding `undefined` for `null`, `undefined`, or an unpopulated relationship id string.
- `backgroundImage` now falls back to `undefined` (no `background-image` style) when there's no resolvable media URL, instead of ever rendering `url(undefined)` or throwing.

No other logic changed — same `Link`, same `classes.card`/`classes.title` class names, same `onClick`/`setCategoryFilters` behavior, same component structure/design.

## Validation
- `npm run lint` → **0 errors**
- `npx tsc --noEmit` → **1 pre-existing error remaining** (`src/app/_blocks/ArchiveBlock/index.tsx(40,9)`, the `sort` prop typing issue — unrelated, untouched). The `CategoryCard` `Cannot find name 'Media'` error is gone.
- `npm run test` → **104/104 passing**

## Scope confirmation
Only `src/app/_components/Categories/CategoryCard/index.tsx` was changed. No changes were made to Payload, GraphQL, native repositories/adapters/services, checkout, auth, cart, or admin. No component redesign — class names, `Link` target, and click behavior are all unchanged. Phase 5 was not started.
