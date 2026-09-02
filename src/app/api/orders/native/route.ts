// src/app/api/orders/native/route.ts
//
// PHASE 13F-A — POST /api/orders/native
//
// Flag-gated (USE_NATIVE_STRIPE_CHECKOUT — see
// ../../../_api/nativeStripeCheckoutFlag.ts; same flag as the Phase 13E
// PaymentIntent-creation route, since this route only makes sense once
// that one has already run for this customer's cart). Requires an
// authenticated user via the EXISTING `getAuthenticatedPayloadUser()`
// helper (Phase 8) — no new auth mechanism.
//
// Closes the rest of Blocker #1 from the Phase 13E report: this is the
// native `OrderService`-backed replacement for CheckoutForm's POST to
// Payload's own `/api/orders` REST endpoint, used only when native
// Stripe checkout is enabled. The legacy `/api/orders` (Payload) call
// CheckoutForm makes by default is completely unaffected — this route
// is additive.
//
// SECURITY: this route never reads a price, total, or cart contents
// from the request body. Cart items are always read fresh from the
// database for the authenticated customer (see
// getCustomerCartItemsNativeStripe), and every price is re-derived
// server-side from current Product records by OrderService (see
// pricing.ts). The ONLY thing this route reads from the request body is
// `paymentIntentId` — the id of a PaymentIntent the client already
// confirmed with Stripe — which is never used for pricing, only stored
// as a reference for the webhook (StripeWebhookService) to later
// reconcile against Stripe's own signed event data. A tampered request
// body cannot influence what gets charged, and cannot mark anything as
// paid on its own — see the webhook route for the only place that
// actually happens.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { UnsupportedCurrencyError } from '../../../../lib/services/PaymentService'
import {
  EmptyCartError,
  MixedCurrencyCartError,
  ProductNotPurchasableError,
} from '../../../../lib/services/pricing'
import { StripeOrderNotFoundForPaymentError } from '../../../../lib/services/StripeOrderService'
import { getAuthenticatedPayloadUser } from '../../../_api/getAuthenticatedPayloadUser'
import { guardNativeStripeCheckoutEnabled } from '../../../_api/nativeStripeCheckoutFlag'
import {
  createNativeStripeOrderNative,
  getCustomerCartItemsNativeStripe,
} from '../../../_api/stripeCheckoutNative'

interface NativeOrderRequestBody {
  paymentIntentId?: unknown
}

const mapOrderCreationError = (error: unknown): NextResponse => {
  if (
    error instanceof EmptyCartError ||
    error instanceof ProductNotPurchasableError ||
    error instanceof MixedCurrencyCartError
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof UnsupportedCurrencyError) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }
  if (error instanceof StripeOrderNotFoundForPaymentError) {
    // Extremely unlikely (an Order was deleted out from under an
    // existing Payment record) — not a client error.
    // eslint-disable-next-line no-console
    console.error('Native Stripe order creation error:', error.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
  // eslint-disable-next-line no-console
  console.error('Native Stripe order creation error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardNativeStripeCheckoutEnabled()
  if (guard) return guard

  const user = await getAuthenticatedPayloadUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to checkout.' }, { status: 401 })
  }

  let body: NativeOrderRequestBody
  try {
    body = (await request.json()) as NativeOrderRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.paymentIntentId !== 'string' || body.paymentIntentId.length === 0) {
    return NextResponse.json({ error: 'paymentIntentId is required' }, { status: 400 })
  }
  const paymentIntentId = body.paymentIntentId

  try {
    // Server-side source of truth for what's being purchased — see the
    // file header. Nothing from `request` is used to determine this.
    const cartItems = await getCustomerCartItemsNativeStripe(user.id)

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
    }

    const { order, payment, alreadyExisted } = await createNativeStripeOrderNative({
      customerId: user.id,
      cartItems,
      paymentIntentId,
    })

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        paymentStatus: payment.status,
      },
      { status: alreadyExisted ? 200 : 201 },
    )
  } catch (error: unknown) {
    return mapOrderCreationError(error)
  }
}
