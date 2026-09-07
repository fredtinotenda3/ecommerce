import React from 'react'
import { Metadata } from 'next'

import { fetchPage } from '../../_api/fetchPage'
import { fetchSettings } from '../../_api/fetchGlobals'
import { Blocks } from '../../_components/Blocks'
import { Gutter } from '../../_components/Gutter'
import { fallbackCart } from '../../_data/fallbackPages'
import type { StorefrontPage, StorefrontSettingsLike } from '../../_types/storefront'
import { generateMeta } from '../../_utilities/generateMeta'
import { CartPage } from './CartPage'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

const loadCartPage = async (): Promise<StorefrontPage> => {
  try {
    return (await fetchPage('cart', 'published')) ?? fallbackCart
  } catch (error) {
    return fallbackCart
  }
}

export default async function Cart() {
  const page = await loadCartPage()

  let settings: StorefrontSettingsLike | null = null

  try {
    settings = await fetchSettings()
  } catch (error) {
    // The "continue shopping" link is the only thing settings drives here.
  }

  return (
    <div className={classes.container}>
      <Gutter>
        <h3>Cart</h3>
        <CartPage settings={settings} />
      </Gutter>
      <Blocks blocks={page?.layout} disableBottomPadding />
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({ doc: await loadCartPage() })
}
