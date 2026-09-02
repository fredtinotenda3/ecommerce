import React from 'react'
import { Metadata } from 'next'

import { fetchSettings } from '../../_api/fetchGlobals'
import { Gutter } from '../../_components/Gutter'
import { StorefrontSettingsLike } from '../../_types/storefront'
import { mergeOpenGraph } from '../../_utilities/mergeOpenGraph'
import { LogoutPage } from './LogoutPage'

import classes from './index.module.scss'

export default async function Logout() {
  // PHASE 13G: narrowed from the full `payload-types.ts` `Settings` —
  // this file only ever passes `settings` straight through to
  // `LogoutPage`, which itself only reads `settings.productsPage.slug`
  // (already narrowed to `StorefrontSettingsLike` in Phase 13F-B). Never
  // read directly in this file.
  let settings: StorefrontSettingsLike | null = null

  try {
    settings = await fetchSettings()
  } catch (error) {
    // when deploying this template on Payload Cloud, this page needs to build before the APIs are live
    // so swallow the error here and simply render the page with fallback data where necessary
    // in production you may want to redirect to a 404  page or at least log the error somewhere
    // console.error(error)
  }

  return (
    <Gutter className={classes.logout}>
      <LogoutPage settings={settings} />
    </Gutter>
  )
}

export const metadata: Metadata = {
  title: 'Logout',
  description: 'You have been logged out.',
  openGraph: mergeOpenGraph({
    title: 'Logout',
    url: '/logout',
  }),
}
