'use client'

// src/app/_components/Price/index.tsx
//
// Renders a product's price, and the previous price when the product is
// genuinely discounted.
//
// Amounts are integers in the currency's minor units and are formatted for
// display only — see src/lib/domain/money.ts, which is the single place
// minor-unit conversion happens. Nothing computed here is ever sent back to
// the server as a price.
//
// A product with no price is not purchasable, so this renders nothing
// rather than "$0.00".
//
// The compare-at price is only shown when it is strictly higher than the
// current price AND in the same currency. A "was" price that fails either
// test is a false discount claim, so it is dropped rather than rendered —
// the adapter applies the same rule, and this is the second line of defence
// for data written before that rule existed.

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
  const compareAt = product?.compareAtPrice

  if (!price) return null

  const multiplier = Number.isFinite(quantity) ? quantity : 1

  const lineTotal = formatMoney({
    amount: price.amount * multiplier,
    currency: price.currency,
  })

  const showCompareAt = Boolean(
    compareAt && compareAt.currency === price.currency && compareAt.amount > price.amount,
  )

  const savedPercent =
    showCompareAt && compareAt
      ? Math.round(((compareAt.amount - price.amount) / compareAt.amount) * 100)
      : 0

  return (
    <div className={classes.actions}>
      <div className={classes.price}>
        <p className={classes.amount}>
          <span className={showCompareAt ? classes.discounted : undefined}>{lineTotal}</span>

          {showCompareAt && compareAt && (
            <React.Fragment>
              {' '}
              {/* `<s>` is announced as struck-through by screen readers, and
                  the visually hidden label says what that means here. */}
              <span className={classes.srOnly}>, reduced from </span>
              <s className={classes.compareAt}>
                {formatMoney({
                  amount: compareAt.amount * multiplier,
                  currency: compareAt.currency,
                })}
              </s>{' '}
              <span className={classes.saving}>Save {savedPercent}%</span>
            </React.Fragment>
          )}
        </p>
      </div>
    </div>
  )
}
