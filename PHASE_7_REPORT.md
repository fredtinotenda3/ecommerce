# PHASE 7 IMPLEMENTATION REPORT

## Paynow Provider Implementation

Added `PaynowProvider` (`src/lib/payments/PaynowProvider.ts`), a concrete
implementation of the Phase 1 `PaymentProvider` interface, backed by
Paynow Zimbabwe's REST API. Supporting modules under
`src/lib/payments/paynow/`:

- `paynowConfig.ts` — server-only env config loader (`PaynowConfigError`
  on missing credentials)
- `paynowSignature.ts` — SHA-512 hash generation/validation, implementing
  Paynow's documented algorithm exactly
- `PaynowHttpClient.ts` — injectable transport (`FetchPaynowHttpClient`
  default, using Node's built-in `fetch`)
- `paynowStatusMap.ts` — maps Paynow's free-text status strings to the
  app's closed `PaymentStatus` enum, throwing on anything unrecognized

**Implemented against Paynow's documented REST API directly**, not the
official `paynow` npm SDK — see "Dependencies/Configuration Added" below
for why.

Endpoints used:
- `POST https://www.paynow.co.zw/interface/initiatetransaction` (web
  redirect checkout only — see Assumptions)
- `GET <pollUrl>` — the poll URL Paynow itself returns from initiate
- Inbound: `handleCallback()` validates/parses a POST Paynow sends to the
  merchant's `resulturl`; this provider does not call out anywhere to
  receive it — that's a Phase 8 route-handler concern

Interface methods implemented:
- `supports(currency)` — pre-flight check only (see Assumptions)
- `createPayment(input)` — full success/failure/hash-verification paths
- `getPaymentStatus(pollUrl)` — polls and maps status
- `handleCallback(rawPayload)` — validates hash, throws
  `InvalidPaynowCallbackError` on failure, otherwise returns a mapped
  `CallbackHandlingResult`
- `supportsRefunds = false`, `refund()` not implemented (see Assumptions)

## Dependencies/Configuration Added

**No new runtime dependency was added.** `package.json` is byte-for-byte
unchanged from the uploaded repository (verified with `diff`).

The brief allowed using either "the official Paynow Node.js SDK or
documented REST API." I chose the documented REST API, implemented with
only Node's built-in `fetch` and `crypto`, for two reasons:
1. The official `paynow` SDK (npm `paynow`, `paynow/Paynow-NodeJS-SDK`)
   is itself a thin wrapper over this exact same HTTP API and hash
   algorithm — there's no behavior it exposes that isn't reproduced here.
2. Task requirement #8 says tests must not require real credentials or
   network access. An injectable `PaynowHttpClient` interface makes this
   straightforward; mocking the official SDK's internal class (which
   bundles `axios` + hashing + parsing into one non-injectable object)
   would be materially more awkward and brittle to test against.

This is flagged per the brief's instruction #9 ("Do NOT add Paynow as a
hard runtime dependency unless the project pattern requires it... flag
it clearly") — no dependency was added at all, hard or soft.

Configuration keys added (all server-side only, read via `process.env`,
**never** prefixed with `NEXT_PUBLIC_`/`PAYLOAD_PUBLIC_`, matching the
existing `STRIPE_SECRET_KEY` pattern in this codebase):

- `PAYNOW_INTEGRATION_ID`
- `PAYNOW_INTEGRATION_KEY`
- `PAYNOW_RESULT_URL`
- `PAYNOW_RETURN_URL`
- `PAYNOW_MODE` (`test` | `live`, defaults to `test` if unset/unrecognized
  — fails safe)

Added to `.env.example` with a comment block; this is the only modified
(pre-existing) file in this phase.

## Paynow API Behavior Verified

Directly fetched and confirmed against developers.paynow.co.zw and the
official SDK's GitHub repo/README:

- **Hash generation** (outbound): concatenate field values (not keys,
  not URL-encoded) in message order, append the integration key, SHA-512,
  uppercase hex. **Verified byte-for-byte** against the worked example on
  the "Generating Hash" doc page — reproduced exactly in
  `tests/paynowSignature.test.ts`.
- **Hash validation** (inbound): split the message into key/value pairs,
  URL-decode each value, concatenate all EXCEPT `hash`, append the
  integration key, SHA-512, uppercase hex, compare. **Verified
  byte-for-byte** against the worked example on the "Validating a hash on
  an inbound message" doc page — also reproduced exactly in tests.
- **Initiate transaction**: `POST` to
  `https://www.paynow.co.zw/interface/initiatetransaction`,
  `application/x-www-form-urlencoded`. A successful response is itself a
  hashed Paynow message (`Status=Ok&BrowserUrl=...&PollUrl=...&Hash=...`)
  and the docs explicitly say the merchant "must verify the hash value"
  before redirecting the customer — implemented as such.
- **Status update / polling**: Paynow POSTs
  `reference=...&paynowreference=...&amount=...&status=...&pollurl=...&hash=...`
  to the merchant's `resulturl`, and returns the same shape from a poll
  URL `GET`. Confirmed via the "Status Update" and "Polling for a Status
  Update" doc pages (worked examples matched, field names confirmed).
- **Test mode**: confirmed via the "Test Mode" doc page that Paynow test
  mode is a property of *which Integration ID/Key you use* (an
  integration starts in test mode until Paynow support "sets it live") —
  there is **no separate sandbox base URL**, unlike Stripe.
- **SDK conventions**: confirmed via the official SDK's README
  (`paynow/Paynow-NodeJS-SDK`) that this is the standard flow other
  language SDKs (PHP, Python, Dart) all wrap identically — `send()` /
  `pollTransaction()` map onto `initiatetransaction` / poll-URL `GET`
  respectively.

## Assumptions

Flagged explicitly here and inline in code comments (with `TODO`-style
notes at each site) per the brief's instruction to avoid inventing
behavior silently:

1. **Field order for the initiate-transaction hash**
   (`id, reference, amount, additionalinfo, returnurl, resulturl,
   status`) is taken directly from the "Generating Hash" doc's worked
   example, which uses this exact order for a structurally identical
   (ticket) transaction. I could not fetch the *live, JS-rendered* field
   table on the "Initiate a transaction" page itself (this environment's
   fetch tool only returns static HTML, and that table renders via
   client-side JS) to cross-check field-by-field. This order is also
   corroborated by every third-party SDK inspected. **Recommend
   confirming with one real Paynow test-mode transaction before Phase
   8 wiring.**

2. **The exhaustive list of Paynow status strings** is similarly not
   fully confirmed against that same JS-rendered table. `mapPaynowStatus`
   covers `Created`, `Sent`, `Pending`, `Paid`, `Awaiting Delivery`,
   `Delivered`, `Cancelled`, `Failed`, `Error`, `Disputed`, `Refunded` —
   the well-documented, cross-SDK-corroborated set — and **throws**
   `UnrecognizedPaynowStatusError` on anything else rather than guessing,
   so a gap here fails loudly in Phase 8, not silently.

3. **Currency**: Paynow's initiate-transaction request has no currency
   parameter — the transaction currency is a property of the merchant's
   Paynow account configuration, not something passed per-request.
   `supports()` is therefore an application-level pre-flight gate only
   (mirrors how `PaymentService` already uses it), defaulting to
   USD-only, overridable via constructor option.

4. **Mobile money (EcoCash/OneMoney Express Checkout) is out of scope**
   for this phase. `CreatePaymentInput` (frozen in Phase 1) has no field
   to select a mobile money method or phone-initiated flow, so
   `createPayment()` always uses the standard web-redirect flow. Adding
   mobile money would require extending `CreatePaymentInput`, which is
   outside this phase's stated scope (implement against the *existing*
   interface).

5. **Refunds**: Paynow does not expose a public merchant-facing refund
   API in any documentation surface I could reach (refunds are described
   as being handled manually via Paynow support/dashboard). Per the
   brief's own guidance, `supportsRefunds = false` and `refund()` is
   simply not implemented (it's optional on the interface).

6. **`PAYNOW_MODE`** does not change which URL is called (see "Test
   mode" above) — it's threaded through purely for logging/consistency
   assertions in future phases, not to select an endpoint.

## Files Created

- `src/lib/payments/PaynowProvider.ts`
- `src/lib/payments/paynow/paynowConfig.ts`
- `src/lib/payments/paynow/paynowSignature.ts`
- `src/lib/payments/paynow/PaynowHttpClient.ts`
- `src/lib/payments/paynow/paynowStatusMap.ts`
- `tests/fakes/FakePaynowHttpClient.ts`
- `tests/PaynowProvider.test.ts`
- `tests/paynowConfig.test.ts`
- `tests/paynowSignature.test.ts`

## Files Modified

- `.env.example` (added `PAYNOW_*` keys, server-side only, clearly
  commented as Phase 7 / not yet wired into checkout)

## Files Deleted

- None

## Validation Results

- **lint** (`npm run lint`): **0 errors**
- **typecheck** (`npx tsc --noEmit`): only the same **1 pre-existing
  error** in `src/app/_blocks/ArchiveBlock/index.tsx` noted in the brief
  as the known baseline — nothing new introduced
- **tests** (`npm run test`): **204/204 passing** — the pre-existing 164
  plus **40 new** Paynow tests (10 hash/signature, 5 config, 25
  provider), all running against fakes/mocks with **no real network
  access or Paynow credentials**. Two of the hash tests assert against
  Paynow's own published worked examples, byte-for-byte.
- `npm run build` was **not** run, per instructions.

## Existing Stripe/Checkout status

**Untouched.** No file under the existing Stripe integration, cart, or
checkout paths was read, modified, or referenced by this phase's code.
`tests/paymentService.test.ts` (pre-existing, provider-agnostic) still
passes unchanged, confirming `PaymentService`'s orchestration logic is
unaffected by this new provider's mere existence — `PaynowProvider` is
never imported or instantiated by any existing checkout code path.

## Existing Auth status

**Untouched.** No auth-related file was read or modified.

## Existing Admin status

**Untouched.** No admin-related file was read or modified. No write
operations were built into native admin, per the brief.

## Remaining Risks

- The two unverified-table items in "Assumptions" (#1, #2) should be
  confirmed against one real Paynow test-mode transaction before Phase
  8 relies on them for anything financially meaningful.
- `handleCallback`'s object-payload fallback (accepting a plain
  `Record<string, unknown>` instead of a raw string/`URLSearchParams`)
  depends on the caller preserving Paynow's original field order, which
  isn't guaranteed for every possible body-parsing middleware. This is
  documented in-code; Phase 8's route handler should prefer passing the
  raw request body string.
- No real end-to-end test against Paynow's actual test-mode API has been
  run (correctly, per the brief) — only the documented algorithm and
  message shapes have been verified.

## Recommended Phase 8

1. Confirm the two flagged assumptions against a real Paynow test-mode
   transaction (a live JS-rendered docs table cross-check, or one actual
   test transaction, would resolve both).
2. Wire `PaynowProvider` into checkout as a second `PaymentProvider`
   alongside Stripe, gated by currency/region so existing Stripe
   customers are unaffected.
3. Add the `resulturl` route handler (a Next.js/Payload API route) that
   receives Paynow's callback POST body as a raw string and passes it
   straight to `PaynowProvider.handleCallback()` → then
   `PaymentService.handleProviderCallback()`.
4. Decide whether mobile money (EcoCash/OneMoney) support is needed; if
   so, extend `CreatePaymentInput` with an optional mobile-method field
   and add a `sendMobile`-equivalent code path.
5. Add a currency/region rule so `PaymentService` picks Paynow vs. Stripe
   per order, rather than requiring the caller to choose a provider
   manually.

---

## STOP CONDITION

Phase 7 is complete. Per the brief, **stopping here** — checkout,
storefront wiring, data migration, Stripe removal, and production
payment-flow changes all wait for explicit approval.
