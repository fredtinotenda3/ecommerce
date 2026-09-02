import React, { Fragment } from 'react'
import { Metadata } from 'next'

import { fetchSettings } from '../../_api/fetchGlobals'
import { isNativeStripeCheckoutEnabled } from '../../_api/nativeStripeCheckoutFlag'
import { isPaynowCheckoutEnabled } from '../../_api/paynowCheckoutFlag'
import { Gutter } from '../../_components/Gutter'
import { Message } from '../../_components/Message'
import { LowImpactHero } from '../../_heros/LowImpact'
import { StorefrontSettingsLike } from '../../_types/storefront'
import { getMeUser } from '../../_utilities/getMeUser'
import { mergeOpenGraph } from '../../_utilities/mergeOpenGraph'
import { CheckoutPage } from './CheckoutPage'

import classes from './index.module.scss'

export default async function Checkout() {
  await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to checkout.',
    )}&redirect=${encodeURIComponent('/checkout')}`,
  })

  // PHASE 13G: narrowed from the full `payload-types.ts` `Settings` —
  // this file only ever passes `settings` straight through to
  // `CheckoutPage`, which itself only reads `settings.productsPage.slug`
  // (already narrowed to `StorefrontSettingsLike` in Phase 13F-B). Never
  // read directly in this file.
  let settings: StorefrontSettingsLike | null = null

  try {
    settings = await fetchSettings()
  } catch (error) {
    // no need to redirect to 404 here, just simply render the page with fallback data where necessary
    console.error(error) // eslint-disable-line no-console
  }

  return (
    <div className={classes.checkout}>
      <Gutter>
        <CheckoutPage
          settings={settings}
          paynowCheckoutEnabled={isPaynowCheckoutEnabled()}
          nativeStripeCheckoutEnabled={isNativeStripeCheckoutEnabled()}
        />
      </Gutter>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Account',
  description: 'Create an account or log in to your existing account.',
  openGraph: mergeOpenGraph({
    title: 'Account',
    url: '/account',
  }),
}
