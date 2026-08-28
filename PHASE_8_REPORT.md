# PHASE 8 IMPLEMENTATION REPORT

## New Checkout/Payment Flow Implemented

A flag-gated (`USE_PAYNOW_CHECKOUT=true`) Paynow checkout path was added alongside the existing Stripe checkout. When the flag is off (default), nothing changes: Stripe remains the only active checkout path and every new route responds `404`, as if it doesn't exist — the same "look like it doesn't exist" convention already used by `USE_NATIVE_AUTH`/`USE_NATIVE_ADMIN`/`USE_NATIVE_REPOSITORY`.

The flow, when enabled:

1. **Initiate** (`POST /api/checkout/paynow/initiate`) — an authenticated customer's server-side cart is re-priced from the database, an `Order` (`PENDING_PAYMENT`) and a `Payment` (`PENDING`, provider `paynow`) are created, and Paynow is asked to start a transaction. The client gets back a `redirectUrl` to send the browser to.
2. **Callback** (`POST /api/payments/paynow/callback`) — Paynow's `resulturl` POST. This is the only writer that can ever mark a `Payment`/`Order` as `PAID`. Hash-validated, idempotent, transitions `Payment` and `Order` state, and clears the cart only on a confirmed first-time `PAID` transition.
3. **Return** (`GET /api/payments/paynow/return?reference=<orderNumber>`) — the browser redirect target after Paynow's hosted page. Purely cosmetic: looks up the `Order` by its `orderNumber` and redirects to the existing `/orders/[id]` page, which re-reads current DB state on every load. No state is ever written here.

Existing Stripe checkout (`/api/create-payment-intent`, `/checkout` page, `CheckoutForm`/`CheckoutPage`), Payload collections/hooks/globals, storefront auth, and cart behavior outside checkout were **not modified**.

## Routes/Handlers Added

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/checkout/paynow/initiate` | Creates Order + Payment from the customer's server-side cart, initiates Paynow transaction |
| `POST` | `/api/payments/paynow/callback` | Paynow's `resulturl` — the sole authoritative payment-confirmation source |
| `GET` | `/api/payments/paynow/return` | Browser return URL — read-only redirect to the order-status page |

All three are gated by `guardPaynowCheckoutEnabled()` (`src/app/_api/paynowCheckoutFlag.ts`) and respond `404` when `USE_PAYNOW_CHECKOUT` is not `"true"`.

## Server-Side Pricing Enforcement

- The initiate route **never reads price, total, or cart contents from the request body**. Cart items are read fresh from the database for the authenticated customer via `getCustomerCartItemsNative` (native `UserRepository`, same underlying `users.cart.items` Payload's own cart UI writes).
- Those cart items (`{ productId, quantity }` only — no price field exists on this type) are handed to the **existing, already-tested** `OrderService.createOrderFromCart`, which re-fetches every product from `ProductRepository` and prices every line item from the product's current `price`/`currency` (`pricing.ts`'s `resolveOrderItems`). This logic was not modified in Phase 8 — Phase 8 only orchestrates calls into it.
- The new orchestrator (`PaynowCheckoutService.initiatePaynowCheckout`) adds no pricing logic of its own; it sequences `OrderService` → `PaymentService` and shapes the result.
- Unpurchasable items (unpublished, no price set, invalid quantity) or mixed-currency carts throw (`ProductNotPurchasableError`, `EmptyCartError`, `MixedCurrencyCartError`) before any `Payment` or Paynow call happens.
- Test coverage: `tests/paynowCheckoutService.test.ts` — "SERVER-AUTHORITATIVE PRICING" test asserts the Order/Payment total comes from the seeded product price, not anything the caller supplies (the input type has no place for a caller to supply a price at all).

## Idempotency Implementation

Two independent layers, implemented in `PaynowCallbackService.processPaynowCallback`:

1. **Hash validation first.** `provider.handleCallback(rawPayload)` (existing, untouched `PaynowProvider`) validates the Paynow hash before anything else runs; an invalid/missing hash throws `InvalidPaynowCallbackError` and no state change of any kind occurs.
2. **Payment-level idempotency.** If the looked-up `Payment` is already in the reported status, the call is a pure no-op — no repository writes, no order transition, no cart clear. This is what makes a Paynow retry of the exact same status update harmless.
3. **Order/cart-level idempotency.** Even on a genuine (non-duplicate) status transition, cart-clearing and purchase-recording are gated on the **order's previous status not already being `PAID`**. Because the state machine (`orderStateMachine.ts`, untouched) has no `PAID → PAID` transition, an order can only ever enter `PAID` once in its lifetime — so this can never double-fire even across multiple `Payment` attempts on the same order.
4. **Uniqueness at the DB layer.** `Payment.merchantReference` has a unique index (pre-existing, from Phase 7/`PaymentRepository`); `PaymentService.initiatePaymentForOrder`'s existing race-handling (duplicate-key → treat as success) is reused unmodified for the initiate path.
5. **Out-of-order/stale deliveries** (e.g. a late `FAILED` arriving after `PAID` was already recorded) are rejected via `assertValidPaymentTransition`/`assertValidOrderTransition` (existing, untouched) rather than silently applied — the callback route logs this and responds `200` (nothing further Paynow can do by retrying).

Test coverage: `tests/paynowCallbackService.test.ts` — dedicated "IDEMPOTENCY" tests assert (a) a duplicate `PAID` callback is flagged `duplicate: true` and does not re-clear a cart the customer has since repopulated, and (b) neither the `Order` nor `Payment` repository is written to a second time (asserted via unchanged `updatedAt`).

## Cart Clearing Behavior

The cart is cleared (`UserRepository.updateCart(customerId, [])`) and the purchase recorded (`UserRepository.appendPurchases`) **only** inside the callback handler, **only** at the exact moment an `Order` transitions from a non-`PAID` status into `PAID` for the first time — never at order-creation time (`PENDING_PAYMENT`), never on a browser return-URL hit, and never on a redelivered/duplicate callback. This directly satisfies the brief's "Cart cleared only after confirmed payment" requirement and rule #4 ("browser redirect is NOT proof of payment").

Note: this deliberately does **not** reuse the existing Payload `afterChange` hook `clearUserCart` (which fires on any Payload `orders` document `create`, i.e. at `PENDING_PAYMENT` time) — that hook's trigger point is wrong for Paynow's async-confirmation flow, and native writes go through a separate Mongoose connection that does not run Payload's hooks anyway (by the existing Phase 1 architecture, documented in `src/lib/db/connection.ts`). The Stripe path's use of `clearUserCart` is untouched.

## Files Created

- `src/lib/services/PaynowCheckoutService.ts` — pure checkout-initiation orchestrator (Order → Payment), unit-testable with fakes
- `src/lib/services/PaynowCallbackService.ts` — pure callback orchestrator (validate → idempotency → Payment/Order transition → cart clear), unit-testable with fakes
- `src/app/_api/paynowCheckoutFlag.ts` — `USE_PAYNOW_CHECKOUT` flag + 404 guard, mirrors `authFlag.ts`/`adminFlag.ts`
- `src/app/_api/getAuthenticatedPayloadUser.ts` — resolves the current user in a Route Handler via the **existing** `payload-token` cookie against Payload's own `/api/users/me` (mirrors `getMeUser.ts`; introduces no new auth mechanism)
- `src/app/_api/paynowCheckout.ts` — DB/provider-wired entry points (concrete `Mongo*Repository` + real `PaynowProvider`), mirrors `adminQueries.ts`/`authNative.ts`
- `src/app/api/checkout/paynow/initiate/route.ts` — `POST` initiate handler
- `src/app/api/payments/paynow/callback/route.ts` — `POST` callback handler (raw-body, hash-validated)
- `src/app/api/payments/paynow/return/route.ts` — `GET` return-URL handler (read-only redirect)
- `tests/paynowCheckoutService.test.ts` — 8 tests
- `tests/paynowCallbackService.test.ts` — 9 tests

## Files Modified

- `.env.example` — added `USE_PAYNOW_CHECKOUT=false` and clarified `PAYNOW_RESULT_URL`/`PAYNOW_RETURN_URL` as now-optional (derived from request origin if unset)

## Files Deleted

None.

## New Dependencies

None. No `package.json` changes — everything is built on existing Phase 1–7 domain code, repositories, and the Phase 7 `PaynowProvider` (which itself uses only Node's built-in `fetch`/`crypto`).

## Environment Flag

```
USE_PAYNOW_CHECKOUT=true   # enables the Paynow checkout path
```

Unset/false (default): every `/api/checkout/paynow/*` and `/api/payments/paynow/*` route responds `404`; Stripe checkout is the only active path, completely unaffected.

## Validation Results

- **lint**: `npm run lint` → 0 errors, 0 warnings
- **typecheck**: `npx tsc --noEmit` → only the same 1 pre-existing error in `src/app/_blocks/ArchiveBlock/index.tsx` (unrelated to this phase, present before any Phase 8 changes)
- **tests**: `npm run test` → **221 passed** (204 pre-existing + 17 new: 8 in `paynowCheckoutService.test.ts`, 9 in `paynowCallbackService.test.ts`)
- `npm run build` was **not** run, per instructions.

## Existing Stripe/Checkout status

Untouched. `src/app/(pages)/checkout/**`, `src/payload/endpoints/create-payment-intent.ts`, and the Orders collection's Payload hooks (`clearUserCart`, `updateUserPurchases`) were not modified in any way. With `USE_PAYNOW_CHECKOUT` off or unset, behavior is byte-for-byte identical to before this phase.

## Existing Auth status

Untouched. No changes to `src/lib/auth/**`, `USE_NATIVE_AUTH`, or any `/api/auth-native/*` route. The new Paynow routes authenticate via Payload's pre-existing `payload-token` cookie mechanism (same one the current checkout page relies on), introducing no new session/auth system.

## Existing Admin status

Untouched. No changes to `/native-admin/*`, `AdminQueryService.ts`, or `AdminAccessService.ts`. Native admin remains read-only, as delivered in Phase 6.

## Remaining Risks

1. **Guest checkout not implemented.** The initiate route requires an authenticated Payload user, matching the existing Stripe checkout's behavior (`getMeUser({ nullUserRedirect: ... })` on the `/checkout` page). If guest Paynow checkout is desired later, it needs a distinct, deliberately-scoped design (the brief flagged this as a genuine option, "if guest, skip user cart persistence").
2. **No storefront UI wired up yet.** Only the backend routes exist. The `/checkout` page's `CheckoutPage` component still only renders the Stripe flow; a Paynow-flag-aware UI branch (redirecting the browser to the `redirectUrl` returned by `/api/checkout/paynow/initiate`) was intentionally left out of this phase's file set to keep the diff backend-only and minimize risk to existing storefront UI/routes, per the brief's "DO NOT change storefront UI/design/routes unnecessarily." **This means the flag can be safely flipped on for API-level testing, but no customer can reach the Paynow flow through the UI yet** — that wiring is recommended for Phase 9.
3. **Flag-off means callback 404s.** If `USE_PAYNOW_CHECKOUT` is turned off after payments were initiated while it was on, any late/retried Paynow callback for those payments will now 404 instead of processing. This mirrors the existing native-auth/admin flag convention but is worth flagging explicitly for a payment-callback endpoint — recommend leaving the flag on for a Paynow "in-flight payment" grace period before disabling.
4. **`PAYNOW_RETURN_URL`/`PAYNOW_RESULT_URL` derivation.** When unset, both URLs are derived from the incoming request's own origin at initiate time. This is convenient for local/dev but should be pinned via the env vars in production so they're stable regardless of which origin/host served the initiate request (matches the existing `.env.example` guidance for these vars).
5. **Refunds** are still not implemented for Paynow (`supportsRefunds: false`, inherited unmodified from Phase 7) — the `Order`/`Payment` state machines support a `REFUNDED` status and this callback orchestrator maps a Paynow `REFUNDED` report onto it, but nothing currently triggers a refund request to Paynow.

## Recommended Phase 9

Wire the `/checkout` storefront page to branch on the Paynow flag (server-side, e.g. via a small server action or a dedicated `/checkout/paynow` variant) and redirect to the `redirectUrl` returned by `/api/checkout/paynow/initiate`, so the flow is reachable end-to-end by a real customer — this was the main piece intentionally deferred from Phase 8 to keep this diff backend-only. Also recommended: an integration/e2e smoke test against Paynow's sandbox environment before any production cutover, and a decision on the guest-checkout question above.

---

**STOP.** Per the brief, Phase 9 (data migration, parallel validation, production cutover, or removing Stripe/Payload) has not been started and will not begin without explicit approval.
