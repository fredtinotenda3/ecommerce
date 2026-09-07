'use client'

// src/app/_components/Price/index.tsx
//
// Renders a product's price.
//
// Amounts are integers in the currency's minor units and are formatted for
// display only — see src/lib/domain/money.ts, which is the single place
// minor-unit conversion happens. Nothing computed here is ever sent back to
// the server as a price.
//
// A product with no price is not purchasable, so this renders nothing
// rather than "$0.00".

import React from 'react'

import { formatMoney } from '../../../lib/domain/money'
import type { StorefrontPriceableProduct } from '../../_types/storefront'

import classes from './index.module.scss'

export const Price: React.FC<{
  product: StorefrontPriceableProduct
  quantity?: number
  button?: 'addToCart' | 'removeFromCart' | false
}> = props => {
  const { product, quantity = 1 } = props
  const price = product?.price

  if (!price) return null

  const lineTotal = formatMoney({
    amount: price.amount * (Number.isFinite(quantity) ? quantity : 1),
    currency: price.currency,
  })

  return (
    <div className={classes.actions}>
      <div className={classes.price}>
        <p>{lineTotal}</p>
      </div>
    </div>
  )
}
