import React from 'react'
import { Metadata } from 'next'

import { fetchSettings } from '../../_api/fetchGlobals'
import { Gutter } from '../../_components/Gutter'
import type { StorefrontSettingsLike } from '../../_types/storefront'
import { getMeUser } from '../../_utilities/getMeUser'
import { mergeOpenGraph } from '../../_utilities/mergeOpenGraph'
import { CheckoutPage } from './CheckoutPage'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

export default async function Checkout() {
  // Checkout is only reachable by an authenticated customer: the payment
  // route resolves the cart and the customer from the session, so an
  // anonymous visitor has nothing to check out.
  await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to checkout.',
    )}&redirect=${encodeURIComponent('/checkout')}`,
  })

  let settings: StorefrontSettingsLike | null = null

  try {
    settings = await fetchSettings()
  } catch (error) {
    // Only drives the "continue shopping" link; render without it.
    console.error('settings read failed:', error) // eslint-disable-line no-console
  }

  return (
    <div className={classes.checkout}>
      <Gutter>
        {/* The page had no <h1> at all: the first heading a screen-reader
            user met was "Payment Details" inside a sub-component. */}
        <header className={classes.intro}>
          <h1 className={classes.heading}>Checkout</h1>
          <p className={classes.introCopy}>
            Check the order below, then pay with Paynow. Nothing is charged until you confirm on
            the Paynow page.
          </p>
        </header>

        <CheckoutPage settings={settings} />
      </Gutter>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Review your order and pay with Paynow.',
  openGraph: mergeOpenGraph({
    title: 'Checkout',
    url: '/checkout',
  }),
}
