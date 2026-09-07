# PHASE 13F-A REPORT — Native Order Creation for Stripe Checkout

## Objective

Add a native order-creation path so a Stripe checkout completed via the
native PaymentIntent route (Phase 13E) can create native Order and
Payment records, and have the native Stripe webhook reconcile them —
without touching Payload, and without changing default (flag-off)
behavior.

## What changed

### 1. `PaymentRepository.getByProviderReference()` (new)
`PaymentRepository` could already look a Payment up by our own
`merchantReference`, but a Stripe webhook event only ever carries
`event.data.object.id` — the PaymentIntent id, i.e. `providerReference`.
Added `getByProviderReference()` to the interface, `MongoPaymentRepository`
(a `findOne` against the already-indexed `providerReference` field — no
migration needed), and `FakePaymentRepository`.

### 2. `StripeProvider` (new, minimal `PaymentProvider` adapter)
`PaymentService` is constructed with a `PaymentProvider`. There wasn't
one for Stripe (only `PaynowProvider` existed). Added a minimal adapter
tagged `name: 'stripe'` whose `supports(currency)` accepts any
well-formed ISO 4217 code by default (Stripe genuinely supports 135+
currencies, unlike Paynow's USD-only in this codebase).
`createPayment`/`getPaymentStatus`/`handleCallback` are intentionally
**unimplemented** — they throw `UnsupportedPaymentOperationError`.
Nothing in the native Stripe path is supposed to call them (see next
section for why), so a loud throw is preferable to a silent no-op if
something ever does.

### 3. `PaymentService.recordProviderInitiatedPayment()` (new method)
The existing `initiatePaymentForOrder()` calls `provider.createPayment()`
— for native Stripe that would create a **second, unused** PaymentIntent,
since the real one already exists by the time an Order does (the native
Stripe flow creates the PaymentIntent from the cart *before* the Order,
the reverse of Paynow's Order-then-initiate-payment order). The new
method records a Payment tied to an already-known `providerReference`
without calling the provider again. Same idempotency contract as
`initiatePaymentForOrder`: a second call for the same order (same
merchant reference) returns the existing Payment, including the same
duplicate-key race handling.

### 4. `StripeOrderService.ts` (new) — `createNativeStripeOrder()`
Pure orchestrator, mirrors `PaynowCheckoutService.ts`'s shape. Given
`{ customerId, cartItems, paymentIntentId }`:
- Checks `paymentRepository.getByProviderReference(paymentIntentId)`
  first — if an Order/Payment already exists for this exact
  PaymentIntent (a retried client request), returns the **existing**
  pair (`alreadyExisted: true`) rather than creating a second Order from
  the same cart. This is the idempotency layer that actually matters
  here (`PaymentService`'s own merchant-reference check only guards a
  single already-created Order, not a duplicate Order in the first
  place).
- Otherwise: `OrderService.createOrderFromCart()` (server-priced,
  `PENDING_PAYMENT`), then `PaymentService.recordProviderInitiatedPayment()`.
- No pricing logic of its own — every price comes from
  `OrderService`/`pricing.ts`, which re-fetches every product fresh from
  the DB. `cartItems` is `{ productId, quantity }[]` only; there's no
  field for a client-supplied price to even go.

### 5. `POST /api/orders/native` (new route)
- `guardNativeStripeCheckoutEnabled()` — 404 unless
  `USE_NATIVE_STRIPE_CHECKOUT=true`.
- `getAuthenticatedPayloadUser()` — 401 if not logged in (existing
  Phase 8 auth helper, no new mechanism).
- Reads cart items from `UserRepository` server-side
  (`getCustomerCartItemsNativeStripe`) — the request body is **only**
  ever read for `paymentIntentId` (a string, validated non-empty).
- Calls `createNativeStripeOrderNative()` and returns
  `{ orderId, orderNumber, paymentId, paymentStatus }`, `201` (or `200`
  if `alreadyExisted`).
- Error mapping: `EmptyCartError` / `ProductNotPurchasableError` /
  `MixedCurrencyCartError` → 400, `UnsupportedCurrencyError` → 422,
  anything else → 500 (logged).

### 6. `StripeWebhookService.ts` — reconciliation (extended)
- `processStripeWebhookEvent()` now also extracts `paymentIntentId` from
  `event.data.object.id` for `payment_intent.*` events it classifies as
  `handled` (undefined for anything else).
- New `reconcileStripePaymentIntentEvent(eventType, paymentIntentId, deps)`,
  mirroring `PaynowCallbackService.ts` field-for-field:
  - `payment_intent.succeeded` → Payment `PAID`, Order `PAID`.
  - `payment_intent.payment_failed` → Payment `FAILED`, Order `PAYMENT_FAILED`.
  - `payment_intent.canceled` → Payment `CANCELLED`, Order `PAYMENT_CANCELLED`.
  - Anything else → returns `null` (not an error).
  - Looks the Payment up by `providerReference` (== the PaymentIntent
    id). `StripePaymentNotFoundError` / `StripeOrderNotFoundError` if
    either side is missing.
  - **Idempotency, two layers**: (1) if the Payment is already in the
    reported status, this is a pure no-op (`duplicate: true`) — no
    writes; (2) transitions are validated against
    `PAYMENT_STATUS_TRANSITIONS`/`ORDER_STATUS_TRANSITIONS`
    (`assertValidPaymentTransition`/`assertValidOrderTransition`) before
    any write, so a stale/out-of-order delivery throws
    `InvalidPaymentTransitionError` rather than corrupting state.
  - Cart-clear + purchase-recording (`userRepository.updateCart(...,[])`,
    `appendPurchases(...)`) only fire on the transition that first makes
    the Order `PAID` — cannot re-fire on a redelivered event, since
    there is no `PAID -> PAID` entry in `ORDER_STATUS_TRANSITIONS` to
    re-enter.

### 7. `/api/payments/stripe/webhook` route (extended)
After a verified, `handled` `payment_intent.*` event, calls
`reconcileStripePaymentIntentEventNative()` and folds the result into
the JSON response (`reconciled`, `duplicate`). Error → HTTP mapping:
`StripePaymentNotFoundError`/`StripeOrderNotFoundError` → 404 (logged);
`InvalidPaymentTransitionError` → 200 with `ignored: true` (retrying
won't change the outcome); signature/config errors unchanged from Phase
13E. Always still returns 2xx for any signature-valid, successfully
reconciled (or idempotently duplicate) event.

### 8. `CheckoutForm` / `CheckoutPage` (extended)
- `CheckoutPage` passes the already-resolved
  `nativeStripeCheckoutEnabled` flag down to `CheckoutForm` (it already
  had this value — it's what decided which PaymentIntent-creation URL to
  call).
- `CheckoutForm` now branches its post-payment order-creation call:
  flag on → `POST /api/orders/native` with `{ paymentIntentId }` only;
  flag off (default) → the **original, unchanged** `POST /api/orders`
  call to Payload with the full items/total payload. Both paths converge
  on the same `router.push('/order-confirmation?order_id=...')` /
  error-redirect behavior as before.

### 9. `scripts/validation/checkFlags.ts`
Updated the `USE_NATIVE_STRIPE_CHECKOUT` flag's `whenOn`/`whenOff`
descriptions to mention native order creation.

## Tests added (35 new test cases, 3 files)

- **`tests/stripeOrderService.test.ts`** (new, 8 cases): server-authoritative
  pricing (cart items carry no price; totals come from
  `FakeProductRepository`'s seeded prices), exactly-one-Order/Payment per
  call, idempotency on repeated `paymentIntentId` (no duplicate Order),
  a different `paymentIntentId` does create a second Order,
  `EmptyCartError`/`ProductNotPurchasableError`/`UnsupportedCurrencyError`
  propagation, and the orphaned-Payment defensive case
  (`StripeOrderNotFoundForPaymentError`).
- **`tests/paymentService.test.ts`** (+4 cases): `recordProviderInitiatedPayment`
  creates a `PENDING` Payment tagged `provider: 'stripe'` with the given
  `providerReference` **without** calling `createPayment` (asserted
  implicitly — `StripeProvider.createPayment` throws if ever reached);
  idempotency (repeat call returns the same Payment, second
  `providerReference` is not applied); `UnsupportedCurrencyError`;
  findable afterwards via `getByProviderReference`.
- **`tests/stripeWebhookService.test.ts`** (+9 reconciliation cases, +1
  extraction case): all three event-type outcomes; idempotent
  redelivery (no double cart-clear, no duplicate purchase entries, cart
  changes made *after* the first reconciliation are preserved);
  unreconciled event type returns `null`; missing
  Payment/Order → the two `StripeXNotFoundError`s;
  out-of-order/stale delivery → `InvalidPaymentTransitionError`;
  `paymentIntentId` is not extracted for unhandled event types even when
  `data.object.id` is present.

## Validation

```
npm run lint            → 0 errors, 0 warnings
npx tsc --noEmit        → 1 pre-existing error (ArchiveBlock/index.tsx,
                           unrelated to this phase — same error present
                           in the Phase 13E baseline)
npm run test             → 356 passed (44 files) — 321 baseline + 35 new,
                           0 failures
npm run validate:flags   → all flags OFF/unset; USE_NATIVE_STRIPE_CHECKOUT
                           description updated; behaviorally identical
                           to pre-Phase-2 production with flags off
```

Dependency install required `npm install --legacy-peer-deps` (the
pre-existing `@payloadcms/plugin-stripe` vs `payload` peer-dependency
conflict noted in the Phase 13D report — unrelated to this phase, no
package.json changes made).

## Security notes

- **Pricing**: `/api/orders/native` never reads a price, total, or cart
  contents from the request body — only `paymentIntentId` (a string,
  used purely as an opaque reference). Cart items are read fresh from
  `UserRepository` for the authenticated user. Every price is
  re-derived server-side by `OrderService`/`pricing.ts` from current
  `Product` records, exactly as the legacy Payload path does.
- **Order/Payment status changes**: nothing about the `/api/orders/native`
  request body can mark a Payment/Order as paid. That only ever happens
  in the webhook route, driven by a **Stripe-signature-verified** event
  (`processStripeWebhookEvent`'s existing signature check from Phase
  13E, unchanged) — the same security property as before this phase.

## Known limitations / out of scope for this phase

1. **Race window between order creation and webhook delivery.** The
   client calls `/api/orders/native` right after `stripe.confirmPayment()`
   resolves, at roughly the same moment Stripe fires
   `payment_intent.succeeded`. If the webhook is delivered and processed
   *before* the order-creation request completes, reconciliation will
   throw `StripePaymentNotFoundError` (mapped to a 404, logged) since no
   Payment with that `providerReference` exists yet. Stripe's own retry
   behavior (exponential backoff over ~3 days) will very likely succeed
   on a later delivery once the Payment exists, but there is no explicit
   retry/reconciliation-on-order-creation step in this phase to close
   that window deterministically. Flagging for a future phase if this
   proves to matter in practice (e.g. a scheduled reconciliation job, or
   having order creation also check Stripe's PaymentIntent status
   directly).
2. **No refund handling.** `supportsRefunds = false` on `StripeProvider`,
   and `reconcileStripePaymentIntentEvent` doesn't handle
   `charge.refunded` / `payment_intent.refunded` — out of scope for this
   phase (order creation + basic reconciliation only, per the objective).
3. **`StripeProvider.supports()` accepts any 3-letter code by default**
   rather than a curated allowlist, since this codebase has no single
   canonical currency and Stripe genuinely supports many. If a specific
   currency allowlist is wanted, pass `supportedCurrencies` to the
   constructor (already supports this) and wire it from an env var in a
   future phase.

## Do NOT / unchanged confirmations

- Payload and `@payloadcms/plugin-stripe` are untouched — not removed,
  not modified, not disabled.
- Default (flag-off) behavior is byte-for-byte unchanged:
  `CheckoutForm` posts to Payload's `/api/orders` exactly as before
  (same request body shape, same response parsing), and
  `/api/orders/native` plus the reconciliation branch of the webhook
  route both 404 / are unreachable when `USE_NATIVE_STRIPE_CHECKOUT` is
  off — confirmed via `npm run validate:flags` above.
