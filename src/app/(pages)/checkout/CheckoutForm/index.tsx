'use client'

import React, { useCallback } from 'react'
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { useRouter } from 'next/navigation'

import { Order } from '../../../../payload/payload-types'
import { Button } from '../../../_components/Button'
import { Message } from '../../../_components/Message'
import { priceFromJSON } from '../../../_components/Price'
import { useCart } from '../../../_providers/Cart'

import classes from './index.module.scss'

export const CheckoutForm: React.FC<{
  /** PHASE 13F-A — server-resolved USE_NATIVE_STRIPE_CHECKOUT flag,
   * passed down from CheckoutPage (same flag that already decided which
   * URL created this PaymentIntent — see CheckoutPage/index.tsx). When
   * true, post-payment order creation calls the new native
   * `/api/orders/native` route (OrderService-backed, no Payload)
   * instead of Payload's own `/api/orders` REST endpoint. When
   * false/omitted (the default), behavior is IDENTICAL to before this
   * phase — nothing below the `stripe?.confirmPayment` call changes. */
  nativeStripeCheckoutEnabled?: boolean
}> = ({ nativeStripeCheckoutEnabled = false }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const router = useRouter()
  const { cart, cartTotal } = useCart()

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault()
      setIsLoading(true)

      try {
        const { error: stripeError, paymentIntent } = await stripe?.confirmPayment({
          elements: elements!,
          redirect: 'if_required',
          confirmParams: {
            return_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/order-confirmation`,
          },
        })

        if (stripeError) {
          setError(stripeError.message)
          setIsLoading(false)
        }

        if (paymentIntent) {
          // Before redirecting to the order confirmation page, we need to create the order.
          // Cannot clear the cart yet because if you clear the cart while in the checkout
          // you will be redirected to the `/cart` page before this redirect happens.
          // Default (flag off): the cart is cleared in an `afterChange` hook on the
          // `orders` collection in Payload. PHASE 13F-A (flag on): the native
          // Stripe webhook clears it once `payment_intent.succeeded` is reconciled
          // (see StripeWebhookService.ts) — same "cleared by the payment-confirming
          // event, not by this request" principle either way.
          try {
            let orderId: string

            if (nativeStripeCheckoutEnabled) {
              // PHASE 13F-A: native, Payload-free order creation. Cart items are
              // never sent — the route re-reads them from the database for the
              // authenticated user (see /api/orders/native's file header) — only
              // the confirmed PaymentIntent's id is sent, purely as a reference
              // for the webhook to reconcile against later.
              const orderReq = await fetch(
                `${process.env.NEXT_PUBLIC_SERVER_URL}/api/orders/native`,
                {
                  method: 'POST',
                  credentials: 'include',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
                },
              )

              const resBody: { error?: string; orderId?: string } = await orderReq.json()

              if (!orderReq.ok || resBody.error || !resBody.orderId) {
                throw new Error(resBody.error || orderReq.statusText || 'Something went wrong.')
              }

              orderId = resBody.orderId
            } else {
              const orderReq = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/api/orders`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  total: cartTotal.raw,
                  stripePaymentIntentID: paymentIntent.id,
                  items: (cart?.items || [])?.map(({ product, quantity }) => ({
                    product: typeof product === 'string' ? product : product.id,
                    quantity,
                    price:
                      typeof product === 'object'
                        ? priceFromJSON(product.priceJSON, 1, true)
                        : undefined,
                  })),
                }),
              })

              if (!orderReq.ok) throw new Error(orderReq.statusText || 'Something went wrong.')

              const {
                error: errorFromRes,
                doc,
              }: {
                message?: string
                error?: string
                doc: Order
              } = await orderReq.json()

              if (errorFromRes) throw new Error(errorFromRes)

              orderId = doc.id
            }

            router.push(`/order-confirmation?order_id=${orderId}`)
          } catch (err) {
            // don't throw an error if the order was not created successfully
            // this is because payment _did_ in fact go through, and we don't want the user to pay twice
            console.error(err.message) // eslint-disable-line no-console
            router.push(`/order-confirmation?error=${encodeURIComponent(err.message)}`)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.'
        setError(`Error while submitting payment: ${msg}`)
        setIsLoading(false)
      }
    },
    [stripe, elements, router, cart, cartTotal, nativeStripeCheckoutEnabled],
  )

  return (
    <form onSubmit={handleSubmit} className={classes.form}>
      {error && <Message error={error} />}
      <PaymentElement />
      <div className={classes.actions}>
        <Button label="Back to cart" href="/cart" appearance="secondary" />
        <Button
          label={isLoading ? 'Loading...' : 'Checkout'}
          type="submit"
          appearance="primary"
          disabled={!stripe || isLoading}
        />
      </div>
    </form>
  )
}

export default CheckoutForm
