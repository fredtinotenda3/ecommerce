// src/app/api/checkout/paynow/initiate/route.ts
//
// PHASE 8 — POST /api/checkout/paynow/initiate
//
// Flag-gated (USE_PAYNOW_CHECKOUT — see ../../../../_api/paynowCheckoutFlag.ts).
// Requires an authenticated Payload user via the EXISTING `payload-token`
// cookie (see ../../../../_api/getAuthenticatedPayloadUser.ts) — no new
// auth mechanism is introduced.
//
// SECURITY: this route never reads a price, total, or cart contents from
// the request body. The request body is not used for pricing at all —
// cart items are always read fresh from the database for the
// authenticated customer (see getCustomerCartItemsNative), and every
// price is re-derived server-side from the current product records by
// OrderService (see src/lib/services/pricing.ts). A client sending a
// tampered body cannot influence what gets charged.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  PaymentInitiationError,
  UnsupportedCurrencyError,
} from '../../../../../lib/services/PaymentService'
import { CheckoutRedirectMissingError } from '../../../../../lib/services/PaynowCheckoutService'
import {
  EmptyCartError,
  MixedCurrencyCartError,
  ProductNotPurchasableError,
} from '../../../../../lib/services/pricing'
import { getAuthenticatedPayloadUser } from '../../../../_api/getAuthenticatedPayloadUser'
import {
  getCustomerCartItemsNative,
  initiatePaynowCheckoutNative,
} from '../../../../_api/paynowCheckout'
import { guardPaynowCheckoutEnabled } from '../../../../_api/paynowCheckoutFlag'

/** Where Paynow POSTs its authoritative status update. A fixed
 * PAYNOW_RESULT_URL (recommended for production — see .env.example)
 * takes precedence; otherwise this route derives one from its own
 * origin so local/dev environments work without extra configuration. */
const getResultUrl = (request: NextRequest): string => {
  const configured = process.env.PAYNOW_RESULT_URL
  if (configured) return configured
  return new URL('/api/payments/paynow/callback', request.nextUrl.origin).toString()
}

const mapCheckoutError = (error: unknown): NextResponse => {
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
  if (error instanceof PaymentInitiationError || error instanceof CheckoutRedirectMissingError) {
    // Upstream (Paynow) problem, not a client error.
    return NextResponse.json(
      { error: 'Unable to start payment. Please try again.' },
      { status: 502 },
    )
  }
  // eslint-disable-next-line no-console
  console.error('Paynow checkout initiation error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function POST(request: NextRequest): Promise<Response> {
  const guard = guardPaynowCheckoutEnabled()
  if (guard) return guard

  const user = await getAuthenticatedPayloadUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to checkout.' }, { status: 401 })
  }

  try {
    // Server-side source of truth for what's being purchased — see the
    // file header. Nothing from `request` is used to determine this.
    const cartItems = await getCustomerCartItemsNative(user.id)

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })
    }

    const resultUrl = getResultUrl(request)
    const origin = request.nextUrl.origin

    const { order, payment, redirectUrl } = await initiatePaynowCheckoutNative({
      customerId: user.id,
      cartItems,
      customerEmail: user.email,
      resultUrl,
      // The Paynow-hosted payment page's browser return URL. Carries the
      // Order's own `orderNumber` (not the raw Mongo `_id`) as
      // `reference`, matching what the callback route looks Payments up
      // by (see PaymentService.initiatePaymentForOrder's merchant
      // reference == order.orderNumber). This URL is NEVER used as proof
      // of payment — see the return route handler.
      buildReturnUrl: builtOrder => {
        const configured = process.env.PAYNOW_RETURN_URL
        const base = configured
          ? new URL(configured)
          : new URL('/api/payments/paynow/return', origin)
        base.searchParams.set('reference', builtOrder.orderNumber)
        return base.toString()
      },
    })

    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentId: payment.id,
        redirectUrl,
      },
      { status: 201 },
    )
  } catch (error: unknown) {
    return mapCheckoutError(error)
  }
}
