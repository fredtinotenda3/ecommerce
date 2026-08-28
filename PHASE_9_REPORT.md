# PHASE 9 IMPLEMENTATION REPORT — Storefront Integration

## Scope

Wired the existing `/checkout` storefront page to the Paynow backend built in Phase 8, so a real customer can reach the flow through the UI when `USE_PAYNOW_CHECKOUT=true`. This was the single item explicitly deferred from Phase 8's file set ("no storefront UI wired up yet").

**Not in scope / not touched:** data migration, parallel validation, production cutover, removing Stripe or Payload — none of these were started, per the original brief's stop condition. This phase is UI wiring only, on top of the already-shipped, already-tested Phase 8 backend.

## What Changed

### `src/app/(pages)/checkout/page.tsx` (modified)

Server component. Now calls the existing `isPaynowCheckoutEnabled()` helper (from `src/app/_api/paynowCheckoutFlag.ts`, built in Phase 8) and passes the result down as a `paynowCheckoutEnabled` prop to `<CheckoutPage>`. This is the only change — the flag is resolved server-side, so it's never exposed as a public/client env var and stays consistent with the same flag the backend routes themselves check.

### `src/app/(pages)/checkout/CheckoutPage/index.tsx` (modified)

Client component. Added an optional `paynowCheckoutEnabled?: boolean` prop (default `false`, so any other caller/story/test that doesn't pass it gets byte-for-byte the old behavior):

- The `useEffect` that creates a Stripe `PaymentIntent` now returns early (no-op) when `paynowCheckoutEnabled` is true — no Stripe API call is made in that case.
- The render branch that shows the Stripe loading state / error / `Elements` + `CheckoutForm` is now wrapped in `{paynowCheckoutEnabled ? <PaynowCheckoutButton /> : ( ...unchanged Stripe JSX... )}`.
- Everything above that branch — the cart-empty message, the itemized cart list (`CheckoutItem`), the order total — is **completely unchanged** and shared by both flows, since it was already flow-agnostic.
- When `paynowCheckoutEnabled` is `false` (the default), the component's behavior, JSX output, and effects are identical to before this phase.

### `src/app/(pages)/checkout/PaynowCheckoutButton/index.tsx` (new)

Client component rendered only when the Paynow flag is on. On click, `POST`s (no body) to `/api/checkout/paynow/initiate` with `credentials: 'include'` (same pattern the Stripe flow already uses for `/api/create-payment-intent`), then does a full browser navigation (`window.location.href`) to the `redirectUrl` the route returns. Shows a loading state on the button and a `Message` error component on failure, reusing the existing `Button`/`Message` components and styling conventions from `CheckoutForm`.

This component **never reads or sends a price/total**. There is no field for one to occupy in the request (a bare `POST`, no body), consistent with Phase 8's server-authoritative pricing guarantee — the backend re-derives everything from the database regardless of what this component does or doesn't send.

### `src/app/(pages)/checkout/PaynowCheckoutButton/index.module.scss` (new)

Minimal styling, reusing existing CSS custom properties (`--base`, `--theme-elevation-600`) already used elsewhere in the codebase (e.g. `Price`, `MediaBlock`, `HighImpact` hero).

## What Was Deliberately Not Changed

- `CheckoutForm`, `CheckoutItem`, Stripe `Elements` setup, `create-payment-intent.ts`, and all Payload collections/hooks — untouched.
- No new routes, no new API surface beyond what Phase 8 already delivered — this phase only added UI that *calls* the existing `/api/checkout/paynow/initiate` route.
- Cart provider (`useCart`), auth provider (`useAuth`) — untouched.
- The order-confirmation experience continues to reuse the existing `/orders/[id]` page (via Phase 8's return-URL route), so no new confirmation page was built.

## Validation Results

- **lint**: `npm run lint` → 0 errors, 0 warnings
- **typecheck**: `npx tsc --noEmit` → only the same 1 pre-existing error in `src/app/_blocks/ArchiveBlock/index.tsx` (present before Phase 8 and Phase 9)
- **tests**: `npm run test` → **221 passed** (unchanged from Phase 8 — see limitation below)
- `npm run build` was not run.

## Limitation: No Automated Test Coverage for the New Component

This repository has no frontend component-testing infrastructure (`vitest.config.ts` runs with `environment: 'node'`; no `jsdom`/`@testing-library/react` dependency is installed). Adding one would be a meaningful infrastructure change outside this phase's scope (a UI-wiring pass on top of an already-tested backend), so `PaynowCheckoutButton` and the `CheckoutPage` branch were validated by:

- Lint + strict typecheck of the new/changed `.tsx` (props, event handlers, fetch response shape all type-check).
- Manual trace-through of both branches (`paynowCheckoutEnabled` true/false) against the actual JSX to confirm the Stripe path's DOM output and effect timing are unchanged when the flag is off.

**Recommendation:** if UI regression coverage is wanted, introducing `@testing-library/react` + `jsdom` (as a separate, explicitly-scoped follow-up) would let `CheckoutPage`'s two branches and `PaynowCheckoutButton`'s loading/error/redirect states be tested directly, rather than only indirectly via the backend orchestration tests already in place from Phase 8.

## Files Created

- `src/app/(pages)/checkout/PaynowCheckoutButton/index.tsx`
- `src/app/(pages)/checkout/PaynowCheckoutButton/index.module.scss`

## Files Modified

- `src/app/(pages)/checkout/CheckoutPage/index.tsx`
- `src/app/(pages)/checkout/page.tsx`

## Files Deleted

None.

## New Dependencies

None.

## How to Try It

1. Set `USE_PAYNOW_CHECKOUT=true` (plus the Phase 7/8 `PAYNOW_INTEGRATION_ID`/`PAYNOW_INTEGRATION_KEY`, and optionally `PAYNOW_RESULT_URL`/`PAYNOW_RETURN_URL`).
2. Log in, add an item to the cart, visit `/checkout`.
3. Instead of the Stripe card form, you'll see the cart summary followed by a "Pay with Paynow" button.
4. Clicking it calls `/api/checkout/paynow/initiate` and redirects to Paynow's hosted payment page.
5. After paying (or cancelling) on Paynow, the browser returns via `/api/payments/paynow/return`, which redirects to `/orders/[id]` showing the order's current (database-authoritative) status.

With the flag off/unset, `/checkout` behaves exactly as it did before Phase 8.

## Remaining Risks (carried over / updated from Phase 8)

1. Guest checkout is still not supported for Paynow (requires login, same as Stripe) — unchanged from Phase 8.
2. No automated UI test coverage for the new component (see above) — new in Phase 9.
3. The other Phase 8 risks (flag-off callback 404s for in-flight payments, `PAYNOW_RETURN_URL`/`PAYNOW_RESULT_URL` pinning for production, no refund flow) still apply unchanged.

---

**STOP.** Per the original brief, data migration, parallel validation, production cutover, and removing Stripe/Payload still require explicit approval and have not been started.
