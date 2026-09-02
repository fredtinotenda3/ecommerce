# PHASE 13I IMPLEMENTATION REPORT

## Native Domain Types Added

Added a new, purely additive "CMS layout / hero — native types (PHASE
13I)" section to `src/lib/domain/types.ts`, inserted before the existing
`Media` section. This implements **step 1 only** of
`docs/native-cms-layout-plan.md`'s §5 "Suggested sequencing" ("Land the
native types... with no consumers yet (pure addition, zero risk)").

Nothing in this section is imported, constructed, or consumed anywhere
else in the codebase yet — verified by `grep`ing for each new type name
outside `src/lib/domain/types.ts` (no matches) and by the fact that
`Page.layout: unknown[]`, `Page.hero: unknown`, and
`Product.layout: unknown[]` were left completely untouched, exactly as
instructed.

New types, all built from this file's own existing vocabulary (`Media`,
`Product`, `Category`, `Page` — no `payload-types.ts` import anywhere):

- `NativeRichTextNode` — named alias for a single rich text node
  (`Record<string, unknown>`), same "typed container, untyped payload"
  treatment as the existing `Media.caption` field.
- `NativeLinkAppearance` — `'default' | 'primary' | 'secondary'`.
- `NativeCMSLink` — the shared link/reference shape (see below).
- `NativeLinkGroupItem` — the `{ id?, link }` wrapper Payload puts around
  every entry in a `links` array.
- `NativeCallToActionBlock`, `NativeContentBlock` (+ `NativeContentColumn`),
  `NativeMediaLayoutBlock`, `NativeArchiveBlock` (+ `NativeArchiveRelation`)
  — the four block shapes.
- `NativeLayoutBlock` — the discriminated union of the four blocks above,
  discriminated on `blockType` as a literal (not widened to `string`),
  per the plan's §5 risk note on preserving control-flow narrowing.
- `NativeHeroType`, `NativeHero` — the hero shape.

## CMS Layout/Hero Types Covered

All four block types named in the task, matching
`docs/native-cms-layout-plan.md` §1's documented Payload shape
field-for-field:

| Native type | Payload block (`blockType`) | Notes |
|---|---|---|
| `NativeCallToActionBlock` | `cta` | `invertBackground?`, `richText`, `links?` |
| `NativeContentBlock` | `content` | `invertBackground?`, `columns?` (each with `size?`, `richText`, `enableLink?`, `link?`) |
| `NativeMediaLayoutBlock` | `mediaBlock` | `invertBackground?`, `position?`, `media: string \| Media` (reuses this file's *full* native `Media` type, per the plan §5's note that this is independent of Phase 13H's `StorefrontMediaItem` view-model) |
| `NativeArchiveBlock` | `archive` | `introContent`, `populateBy?`, `relationTo?`, `categories?`, `limit?`, `selectedDocs?`, `populatedDocs?`, `populatedDocsTotal?` |

One deliberate, documented deviation from the Payload source shape: per
the plan's §3.6 / §5 risk note, `archive.categories` is typed as
`string[]` only (not `string[] | Category[]`), because
`layoutRelationsAdapter.ts` does not resolve it today and nothing in the
codebase produces the resolved form — widening this is explicitly
deferred to the future "migrate archive" phase (plan §5, step 7), which
the type's own doc comment says so. `archive.populatedDocs`, which **is**
resolved today, keeps the `string | Product` union via
`NativeArchiveRelation`.

`hero` is modelled as a single `NativeHero` shape with a `type`
discriminant field (`NativeHeroType`), **not** a discriminated union of
per-variant shapes — this matches the actual Payload source shape (§1:
one object, `richText`/`links`/`media` shared across all variants; only
the rendered *component* varies by `type`), not a design simplification.
`ProductHero` (which doesn't consume `Page['hero']` at all, per the plan
§1) has no native type here — out of scope by the plan's own account.

`relatedProducts` — the plan's §1 "fifth, UI-only block" — is explicitly
excluded from `NativeLayoutBlock`, matching the plan's own guidance that
it's synthesized at render time, not a real CMS-authored block.

## Link/Reference Types Added

`NativeCMSLink` — extracted once, per the plan's §3.3 recommendation
("worth extracting once rather than four times"), used by
`NativeCallToActionBlock.links`, `NativeContentColumn.link`, and
`NativeHero.links`. Mirrors the Payload `CMSLinkShape` documented in the
plan §1 exactly: `type?`, `newTab?`, `reference?: { relationTo: 'pages';
value: string | Page }`, `url?`, `label`, `icon?: string | Media`,
`appearance?`.

Not wired into `Header.navItems`/`Footer.navItems` in this phase — those
already have their own native `NavLink`/`NavItem` types (added in Phase
13D, id-based with resolution happening at the caller), which are a
different, already-shipped design from what this plan describes for the
CMS-block link shape. Reconciling the two (or confirming they should stay
distinct) is plan §5 step 3's job, not this phase's.

## Files Created

- `tests/nativeCmsLayoutTypes.test.ts` — pure type-level tests (see
  below).

## Files Modified

- `src/lib/domain/types.ts` — additive only. No existing line changed,
  moved, or removed; the new section was inserted as a whole between the
  existing `Page` and `Media` sections.

## Files Deleted

None.

## New Dependencies

None.

## Existing Payload Status

Untouched. No file under `src/payload/**` was read for anything beyond
already-established context (`payload-types.ts` was not opened this
phase; the field shapes referenced above come from
`docs/native-cms-layout-plan.md`'s own §1, written in Phase 13H). No
repository adapter, native fetch helper, component, or the Cart
provider/reducer was modified, per the DO NOT list.

## Existing Stripe Status

Untouched. Nothing in this phase touches checkout, payments, or Stripe
in any way.

## Remaining payload-types Import Count

**51 — unchanged from the stated baseline.** Verified via:
```
grep -rl "from '.*payload-types'" src --include=*.ts --include=*.tsx | grep -v "^src/payload/" | wc -l
```
both before and after this phase's changes. Expected: this phase adds
types with zero consumers, so it cannot reduce (or increase) the import
count by construction.

## Validation Results

- **lint** (`npm run lint`): 0 errors. (One `prettier/prettier` formatting
  nit surfaced on first run in the new `domain/types.ts` section — an
  extra blank line — fixed via `eslint --fix`, no content change.)
- **typecheck** (`npx tsc --noEmit`): only the same 1 pre-existing error
  in `src/app/_blocks/ArchiveBlock/index.tsx` from the baseline. No new
  type errors — confirms `domain/types.ts` still compiles cleanly with
  the new section added.
- **tests** (`npm run test`): **379 tests passing** (47 test files),
  including the 7 new tests in `tests/nativeCmsLayoutTypes.test.ts`. No
  existing test file was touched or needed changes.
- **validate:flags** (`npm run validate:flags`, run for completeness
  though not strictly required by this phase's task list): all flags
  report off/unset — this phase cannot have changed default behavior
  since it added no consumer of anything.
- `npm run build` was not run (not requested this phase; consistent with
  prior phases' convention of skipping it without a full deployment
  environment).

### On the "pure type-level tests" task

Per the task's own framing ("TypeScript types are compile-time... you do
not need to force runtime tests"), `tests/nativeCmsLayoutTypes.test.ts`
does two things rather than asserting business logic:
1. Constructs a realistic literal object for every new type (minimal and
   fully-populated variants), which only compiles if the shapes in
   `domain/types.ts` are structurally correct — a typo'd or missing
   field fails `npm run test`'s `tsc`-backed collection step.
2. Asserts, at runtime, that `switch`-based narrowing on
   `NativeLayoutBlock.blockType` actually discriminates correctly across
   all four members — the one specific failure mode the plan's §5 risk
   section calls out by name (silent degradation to `any`/`unknown`
   given `strict: false` in `tsconfig.json`).

## Remaining Blockers

Unchanged from the stated baseline, plus the plan's own remaining steps
(2–8) are all still open — this phase completed only step 1:

1. **No native `Media.sizes` / full responsive media equivalent** —
   untouched this phase (out of scope; DO NOT list explicitly excludes
   the `Media` component / responsive media logic).
2. **`CMS Page['layout']` / `Page['hero']` unions have no native
   equivalent used anywhere** — the types now exist (this phase), but
   `layoutRelationsAdapter.ts` still walks an untyped `RawBlock =
   Record<string, any>`, and `pageStorefrontAdapter.ts`/
   `productStorefrontAdapter.ts` still produce their output via unchecked
   `as PayloadPage['layout']` / `as PayloadPage['hero']` casts. Plan §5
   step 2 (real parsing/validation against these new types, still
   producing the same Payload-shaped external contract) is the next
   piece of actual risk-reduction — this phase is foundation only.
3. **Cart reducer `CartItem`/`Product` coupling remains** — untouched
   this phase, per the DO NOT list.
4. **payload-types import count (51) is unchanged** — expected; see
   above. Reducing it requires wiring consumers to the new types, which
   is explicitly out of scope for this phase.

## Recommended Next Phase

**Phase 13J: `layoutRelationsAdapter.ts` real parsing (plan §5, step
2).** Replace the untyped `RawBlock` walk with real validation/parsing
against the `NativeLayoutBlock`/`NativeHero`/`NativeCMSLink` types added
this phase, while keeping `resolveStorefrontLayout`/`resolveStorefrontHero`'s
**external** return shape identical (still ultimately consumed via the
existing `as PayloadPage['layout']`/`as PayloadPage['hero']` casts in
`pageStorefrontAdapter.ts`/`productStorefrontAdapter.ts`, unchanged in
this next phase too). This is the step the plan's own "Risks" section
(§5) flags as the one most likely to surface real, pre-existing data
issues (malformed or missing fields on stored blocks that currently
satisfy an `as` cast silently) — worth doing in isolation from any
render-layer change, exactly as the plan sequences it, before touching
the link/reference union (step 3) or any block/hero component.

---

**STOP CONDITION:** Phase 13I is complete. Payload and Stripe have not
been touched. Production cutover has not been started. Waiting for
explicit approval before any Payload removal, Stripe removal, or
production cutover.
