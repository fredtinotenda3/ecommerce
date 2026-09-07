# PHASE 13J IMPLEMENTATION REPORT

## Parsing/Validation Implemented

Rewrote `src/lib/repositories/adapters/layoutRelationsAdapter.ts`'s
internal walk to be driven by real structural type guards against the
Phase 13I native CMS types (`NativeLayoutBlock`, `NativeHero`,
`NativeCMSLink` — all from `src/lib/domain/types.ts`), replacing the
previous implicit-trust `block.blockType === '...'` string comparisons
on an untyped `RawBlock = Record<string, any>`.

New validation primitives, all deliberately **permissive** rather than a
strict schema validator (see the file's own new header section for the
full rationale — a stricter check would make legitimately-sparse stored
data silently skip resolution, which is worse than the pre-13J
behavior, not better):

- `isPlainObject(value)` — the base "is this even a resolvable
  object" guard, used everywhere a raw value previously got a bare
  `typeof x === 'object'` check.
- `isKnownLayoutBlockType(block)` — structural guard (`block is RawBlock
  & { blockType: NativeLayoutBlockType }`) replacing the bare
  `switch (block.blockType)` dispatch. `NativeLayoutBlockType` is
  derived directly from `NativeLayoutBlock['blockType']` (Phase 13I's
  union), so the four recognized values live in exactly one place.
- `isReferenceLink(link)` — structural guard against `NativeCMSLink`,
  formalizing what was previously an inline
  `link.type !== 'reference' || !link.reference?.value` check into a
  real type predicate with the same truthiness semantics preserved
  exactly (verified with a new test — see below).
- `isKnownHeroType(value)` — **soft** validation only: logs a
  `console.warn` when a stored hero's `type` isn't one of `NativeHero`'s
  five known literals, but never changes `resolveStorefrontHero`'s
  return value based on the result (the pre-13J code never inspected or
  transformed `hero.type` either — only `media`/`links` are touched — so
  making an unrecognized `type` change the OUTPUT would be new behavior,
  not validation of old behavior).

**Fail-safe wrapping (new):** `resolveBlock` and `resolveStorefrontHero`
now wrap their resolution work in `try/catch`. If anything throws while
resolving a single block or the hero (e.g. a repository lookup failing),
the error is logged via `console.error` and the function falls back to
returning the untouched raw input — the same outcome as the existing
"unrecognized blockType" passthrough, but now also covering the
"recognized blockType, but something in resolution failed" case. This
directly satisfies task 4's "malformed... block types fail safely...
without breaking the request" for the resolution-time failure mode (as
opposed to the shape-mismatch failure mode, which the permissive guards
above already handle by coercing/passing through rather than throwing in
the first place).

## External Return Shape Compatibility

**Unchanged, verified two ways:**

1. All 10 pre-existing tests in `tests/layoutRelationsAdapter.test.ts`
   were left completely untouched (not one assertion edited) and all
   still pass — these already cover: empty/non-array layout input →
   `[]`; `mediaBlock` media resolution (found and not-found cases);
   `cta` link reference resolution; `content` column link resolution
   (respecting `enableLink`); `archive.populatedDocs` resolution (both
   with and without a `productRepository` — including the
   reference-equality (`toBe(raw)`) assertion for the no-repository
   case, which the rewrite specifically preserves by never copying an
   already-array `populatedDocs` value before handing it to
   `resolveArchivePopulatedDocs`); unknown `blockType` passthrough; and
   hero media/link resolution. All pass unchanged.
2. `pageStorefrontAdapter.ts` and `productStorefrontAdapter.ts` — the
   two files whose `as PayloadPage['layout']` / `as PayloadPage['hero']`
   casts depend on this file's output shape — were not opened for
   editing this phase (verified: their casts are byte-for-byte present,
   grepped after this phase's changes). Their own existing tests
   (`tests/pageStorefrontAdapter.test.ts`,
   `tests/productStorefrontAdapter.test.ts`) also still pass unchanged,
   confirming the seam between the two files still behaves identically
   from their perspective.

`resolveStorefrontLayout`'s signature
(`(blocks: unknown[] | undefined, deps) => Promise<unknown[]>`) and
`resolveStorefrontHero`'s (`(hero: unknown, deps) => Promise<RawBlock |
null>`) are byte-for-byte identical to before this phase.

## Files Created

None.

## Files Modified

- `src/lib/repositories/adapters/layoutRelationsAdapter.ts` — internal
  rewrite only (see above); public exports and their behavior for
  well-formed input unchanged.
- `tests/layoutRelationsAdapter.test.ts` — 10 pre-existing tests
  unchanged; 11 new tests appended (two new `describe` blocks) covering:
  - Missing/optional fields (`cta` with no `richText`/`links`,
    `mediaBlock` with no `media`, hero with no `richText`/`links`/`media`)
    don't throw.
  - Malformed field *types* (`links`/`columns` present but not arrays)
    don't throw and pass the value through unchanged.
  - Non-object entries (`null`, a string, a number) mixed into an
    otherwise-valid layout array don't throw and pass through unchanged.
  - A link with a falsy `reference.value` (e.g. `''`) is treated as
    non-resolvable and passed through unchanged (proves `isReferenceLink`
    preserves the exact pre-13J truthiness semantics, not just the
    `!= null` case).
  - A fully unrecognized `blockType`, even with relation-shaped fields
    (`media`, `links` that reference real seeded data), is passed through
    with **no** resolution attempt — not just "resolution that happens to
    find nothing."
  - Fail-safe behavior: a `ProductRepository`/`MediaRepository` whose
    `getById` throws does not propagate the error out of
    `resolveStorefrontLayout`/`resolveStorefrontHero` — the raw
    block/hero is returned untouched instead.
  - A hero with an unrecognized `type` still resolves `media`/`links`
    normally (soft validation only, per `isKnownHeroType`'s contract
    above).

## Files Deleted

None.

## New Dependencies

None.

## Existing Payload Status

Untouched. No file under `src/payload/**` was modified. This phase's
only import from anywhere Payload-adjacent is the pre-existing
`import type { Media as PayloadMedia, Product as PayloadProduct } from
'../../../payload/payload-types'` at the top of
`layoutRelationsAdapter.ts` — already present before this phase (the
adapter's OUTPUT is still Payload-shaped, by design, per the plan's own
"keep the external contract identical" instruction), not a new import
this phase added.

## Existing Stripe Status

Untouched. Nothing in this phase touches checkout, payments, or Stripe
in any way.

## Remaining payload-types Import Count

**51 — unchanged.** Verified via the same grep used in Phase 13I's
report, run both before and after this phase's changes:
```
grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l
```
Expected: this phase changed only `layoutRelationsAdapter.ts`'s
*internal* logic; its existing `payload-types.ts` import (for
`PayloadMedia`/`PayloadProduct`, used to type the still-Payload-shaped
return value) was already counted in the 51 before this phase and is
unchanged, and no other file was touched.

## Validation Results

- **lint** (`npm run lint`): 0 errors. (Two `@typescript-eslint/no-implicit-any-catch`
  errors surfaced on first run for the new `catch (error)` blocks — fixed
  by annotating `catch (error: unknown)`, no logic change. Import
  ordering was also auto-fixed via `eslint --fix`.)
- **typecheck** (`npx tsc --noEmit`): only the same 1 pre-existing error
  in `src/app/_blocks/ArchiveBlock/index.tsx` from the baseline. No new
  type errors.
- **tests** (`npm run test`): **390 tests passing** (47 test files) —
  379 from the Phase 13I baseline plus 11 new tests in
  `tests/layoutRelationsAdapter.test.ts`. The new fail-safe tests
  intentionally trigger the new `console.error`/`console.warn` calls
  (visible as stderr output in the test run, not failures) to prove the
  catch paths are actually exercised, not just present in the source.
- **validate:flags** (`npm run validate:flags`, run for completeness):
  all flags report off/unset — expected, since this phase touched no
  flag-gated code path at all.
- `npm run build` was **not** run, per the task instructions.

## Remaining Blockers

Unchanged from the stated baseline, minus this phase's own item:

1. **No native `Media.sizes` / full responsive media equivalent** —
   untouched this phase (out of scope; DO NOT list explicitly excludes
   Media/responsive media logic).
2. **`pageStorefrontAdapter.ts`/`productStorefrontAdapter.ts` still use
   unchecked `as PayloadPage['layout']` / `as PayloadPage['hero']`
   casts** — explicitly NOT touched this phase, per the task's own scope
   note ("This phase is limited to making the adapter internally
   safer"). The internal walk they depend on is now structurally
   validated, but the seam itself (the cast) is still a cast — closing
   that is plan §5 step 8's job ("Dispatcher/adapter cleanup (optional)"),
   explicitly sequenced *after* steps 3–7 (link/block/hero migration),
   not this phase.
3. **Cart reducer `CartItem`/`Product` coupling remains** — untouched
   this phase, per the DO NOT list.
4. **`payload-types` import count (51) is unchanged** — expected; this
   phase made the existing adapter safer internally without wiring any
   new consumer of the Phase 13I native types, so it could not reduce
   the count by construction (same as Phase 13I's own report noted for
   the same reason).
5. **`archive.categories`/`archive.selectedDocs` remain unresolved** —
   unchanged from Phase 3's original scope limit (see the plan §3.6);
   this phase's `NativeArchiveBlock` type (from 13I) and this phase's
   validation both preserve that scope limit rather than closing it, per
   the plan's own explicit deferral of that decision to "migrate archive"
   (plan §5, step 7).

## Recommended Next Phase

Per `docs/native-cms-layout-plan.md` §5's sequencing, the next two
candidates (either is reasonably scoped as its own phase):

- **Phase 13K: link/reference union migration (plan §5, step 3).**
  Migrate `CMSLink` (`src/app/_components/Link/index.tsx`) and the two
  nav globals (`Header/Nav`, `HeaderComponent`, `Header/index.tsx`,
  `Footer/FooterComponent`, `Footer/index.tsx`) onto `NativeCMSLink`
  where safe — the plan flags this as the lowest-fanout, independently-
  provable piece to migrate first, and this phase's `isReferenceLink`
  guard (now proven against the exact pre-existing truthiness semantics
  via a dedicated test) is a solid foundation for it.
- **Phase 13K-alt: `mediaBlock` end-to-end (plan §5, step 4).** The
  plan's own recommendation for "smallest surface" first, reusing the
  *full* native `Media` type (already defined, unrelated to Phase 13H's
  narrower `StorefrontMediaItem`) with no new domain type needed.

Either should land before attempting `pageStorefrontAdapter.ts`/
`productStorefrontAdapter.ts`'s cast removal (blocker #2 above), since
that cast can only go away once whatever consumes the adapter's output
(`Blocks`, `Hero`, and each block/hero component) is itself migrated —
exactly the ordering the plan's §5 already lays out.

---

**STOP CONDITION:** Phase 13J is complete. Payload and Stripe have not
been touched. Production cutover has not been started. Waiting for
explicit approval before any Payload removal, Stripe removal, or
production cutover.
