'use client'

import React, { Fragment, useEffect } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Settings } from '../../../../payload/payload-types'
import { Button } from '../../../_components/Button'
import { LoadingShimmer } from '../../../_components/LoadingShimmer'
import { useAuth } from '../../../_providers/Auth'
import { useCart } from '../../../_providers/Cart'
import { useTheme } from '../../../_providers/Theme'
import cssVariables from '../../../cssVariables'
import { CheckoutForm } from '../CheckoutForm'
import { CheckoutItem } from '../CheckoutItem'
import { PaynowCheckoutButton } from '../PaynowCheckoutButton'

import classes from './index.module.scss'

const apiKey = `${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`
const stripe = loadStripe(apiKey)

export const CheckoutPage: React.FC<{
  settings: Settings
  /** PHASE 9 — server-resolved USE_PAYNOW_CHECKOUT flag (see
   * ../../../_api/paynowCheckoutFlag.ts), passed down from the server
   * component in page.tsx. When true, this component renders the
   * Paynow flow (PaynowCheckoutButton) instead of Stripe Elements, and
   * skips creating a Stripe PaymentIntent entirely. When false/omitted
   * (the default), behavior is IDENTICAL to before Phase 9 — the
   * existing Stripe checkout is untouched. */
  paynowCheckoutEnabled?: boolean
  /** PHASE 13E — server-resolved USE_NATIVE_STRIPE_CHECKOUT flag (see
   * ../../../_api/nativeStripeCheckoutFlag.ts). Only consulted when
   * `paynowCheckoutEnabled` is false. When true, the PaymentIntent is
   * requested from the new native route
   * (`/api/checkout/stripe/create-payment-intent`) instead of Payload's
   * `/api/create-payment-intent`. Everything else about this Stripe
   * Elements flow — the UI, `CheckoutForm`, the `client_secret` handling
   * below — is unchanged; only the URL differs. When false/omitted (the
   * default), behavior is IDENTICAL to before Phase 13E. */
  nativeStripeCheckoutEnabled?: boolean
}> = props => {
  const {
    settings: { productsPage },
    paynowCheckoutEnabled = false,
    nativeStripeCheckoutEnabled = false,
  } = props

  const { user } = useAuth()
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [clientSecret, setClientSecret] = React.useState()
  const hasMadePaymentIntent = React.useRef(false)
  const { theme } = useTheme()

  const { cart, cartIsEmpty, cartTotal } = useCart()

  useEffect(() => {
    if (user !== null && cartIsEmpty) {
      router.push('/cart')
    }
  }, [router, user, cartIsEmpty])

  useEffect(() => {
    // The Paynow flow initiates payment on demand (see
    // PaynowCheckoutButton) rather than up front — no PaymentIntent (or
    // Paynow equivalent) needs to exist before the customer clicks
    // "Pay with Paynow", so this effect is a pure no-op in that case.
    if (paynowCheckoutEnabled) return

    if (user && cart && hasMadePaymentIntent.current === false) {
      hasMadePaymentIntent.current = true

      const makeIntent = async () => {
        try {
          // PHASE 13E: same request (POST, credentials included, no
          // body — pricing is always re-derived server-side from the
          // authenticated user's cart), just a different URL when the
          // native flag is on. Default path (flag off) is unchanged.
          const url = nativeStripeCheckoutEnabled
            ? `${process.env.NEXT_PUBLIC_SERVER_URL}/api/checkout/stripe/create-payment-intent`
            : `${process.env.NEXT_PUBLIC_SERVER_URL}/api/create-payment-intent`

          const paymentReq = await fetch(url, {
            method: 'POST',
            credentials: 'include',
          })

          const res = await paymentReq.json()

          if (res.error) {
            setError(res.error)
          } else if (res.client_secret) {
            setError(null)
            setClientSecret(res.client_secret)
          }
        } catch (e) {
          setError('Something went wrong.')
        }
      }

      makeIntent()
    }
  }, [cart, user, paynowCheckoutEnabled, nativeStripeCheckoutEnabled])

  if (!user) return null
  if (!paynowCheckoutEnabled && !stripe) return null

  return (
    <Fragment>
      {cartIsEmpty && (
        <div>
          {'Your '}
          <Link href="/cart">cart</Link>
          {' is empty.'}
          {typeof productsPage === 'object' && productsPage?.slug && (
            <Fragment>
              {' '}
              <Link href={`/${productsPage.slug}`}>Continue shopping?</Link>
            </Fragment>
          )}
        </div>
      )}
      {!cartIsEmpty && (
        <div className={classes.items}>
          <div className={classes.header}>
            <p>Products</p>
            <div className={classes.headerItemDetails}>
              <p></p>
              <p className={classes.quantity}>Quantity</p>
            </div>
            <p className={classes.subtotal}>Subtotal</p>
          </div>

          <ul>
            {cart?.items?.map((item, index) => {
              if (typeof item.product === 'object') {
                const {
                  quantity,
                  product,
                  product: { title, meta },
                } = item

                if (!quantity) return null

                const metaImage = meta?.image

                return (
                  <Fragment key={index}>
                    <CheckoutItem
                      product={product}
                      title={title}
                      metaImage={metaImage}
                      quantity={quantity}
                      index={index}
                    />
                  </Fragment>
                )
              }
              return null
            })}
            <div className={classes.orderTotal}>
              <p>Order Total</p>
              <p>{cartTotal.formatted}</p>
            </div>
          </ul>
        </div>
      )}
      {paynowCheckoutEnabled ? (
        // PHASE 9 — Paynow flow. No PaymentIntent/clientSecret concept
        // applies here; PaynowCheckoutButton calls
        // /api/checkout/paynow/initiate itself, on demand, and handles
        // its own loading/error state. Nothing renders here at all
        // while the cart is empty (mirrors the Stripe branch below,
        // which never got this far in that case either since
        // `cartIsEmpty` redirects to `/cart` — this additional guard is
        // just belt-and-suspenders against a render before that
        // redirect takes effect).
        !cartIsEmpty && <PaynowCheckoutButton />
      ) : (
        <Fragment>
          {!clientSecret && !error && (
            <div className={classes.loading}>
              <LoadingShimmer number={2} />
            </div>
          )}
          {!clientSecret && error && (
            <div className={classes.error}>
              <p>{`Error: ${error}`}</p>
              <Button label="Back to cart" href="/cart" appearance="secondary" />
            </div>
          )}
          {clientSecret && (
            <Fragment>
              <h3 className={classes.payment}>Payment Details</h3>
              {error && <p>{`Error: ${error}`}</p>}
              <Elements
                stripe={stripe}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorText:
                        theme === 'dark' ? cssVariables.colors.base0 : cssVariables.colors.base1000,
                      fontSizeBase: '16px',
                      fontWeightNormal: '500',
                      fontWeightBold: '600',
                      colorBackground:
                        theme === 'dark' ? cssVariables.colors.base850 : cssVariables.colors.base0,
                      fontFamily: 'Inter, sans-serif',
                      colorTextPlaceholder: cssVariables.colors.base500,
                      colorIcon:
                        theme === 'dark' ? cssVariables.colors.base0 : cssVariables.colors.base1000,
                      borderRadius: '0px',
                      colorDanger: cssVariables.colors.error500,
                      colorDangerText: cssVariables.colors.error500,
                    },
                  },
                }}
              >
                <CheckoutForm nativeStripeCheckoutEnabled={nativeStripeCheckoutEnabled} />
              </Elements>
            </Fragment>
          )}
        </Fragment>
      )}
    </Fragment>
  )
}
