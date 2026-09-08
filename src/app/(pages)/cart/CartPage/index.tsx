'use client'

// src/app/(pages)/cart/CartPage/index.tsx
//
// The cart: line items on the left, an order summary that follows the
// scroll on the right.
//
// The summary states exactly what will be charged. The previous version
// printed a hard-coded "Delivery Charge $0" line, which happened to match
// what the pricing service does (`computeTotal` adds nothing to the
// subtotal) but read as a placeholder and left the customer unsure whether
// something would appear later. It now says so explicitly, because the
// commonest reason a full cart is abandoned is a suspicion that the number
// will grow at the next step.
//
// Nothing about how totals are calculated changed. The server remains the
// only authority on price (see `src/lib/services/pricing.ts`); everything
// here is display.

import React, { Fragment } from 'react'
import Link from 'next/link'

import { EmptyState } from '../../../_components/EmptyState'
import { useAuth } from '../../../_providers/Auth'
import { useCart } from '../../../_providers/Cart'
import { StorefrontSettingsLike } from '../../../_types/storefront'
import CartItem from '../CartItem'

import classes from './index.module.scss'

export const CartPage: React.FC<{
  /** Only read for `productsPage.slug`, to link back to the catalogue. */
  settings: StorefrontSettingsLike | null
}> = props => {
  const { settings } = props
  const { productsPage } = settings || {}

  const { user } = useAuth()
  const { cart, cartIsEmpty, addItemToCart, cartTotal, hasInitializedCart } = useCart()

  const shopHref =
    typeof productsPage === 'object' && productsPage?.slug ? `/${productsPage.slug}` : '/products'

  const itemCount = (cart?.items || []).reduce(
    (total, item) => total + (typeof item.quantity === 'number' ? item.quantity : 0),
    0,
  )

  // Skeletons rather than a spinner: the cart's shape is known before its
  // contents are, so the page can settle into its final layout immediately.
  if (!hasInitializedCart) {
    return (
      <div className={classes.cartWrapper} aria-busy="true">
        <div>
          <ul className={classes.itemsList}>
            {[0, 1].map(index => (
              <li key={index} className={classes.skeletonRow} />
            ))}
          </ul>
        </div>
        <div className={classes.summary}>
          <div className={classes.skeletonSummary} />
        </div>
      </div>
    )
  }

  if (cartIsEmpty) {
    return (
      <EmptyState
        className={classes.empty}
        title="Your cart is empty"
        description={
          user
            ? 'Nothing here yet. Everything in stock ships within one working day.'
            : 'Nothing here yet. If you added items while signed in, sign back in to pick up where you left off.'
        }
        action={{ label: 'Browse the shop', href: shopHref }}
      />
    )
  }

  return (
    <Fragment>
      <div className={classes.cartWrapper}>
        <div className={classes.items}>
          <div className={classes.header}>
            <p>Item</p>
            <p className={classes.headerQuantity}>Quantity</p>
            <p className={classes.headerSubtotal}>Subtotal</p>
          </div>

          <ul className={classes.itemsList}>
            {cart?.items?.map(item => {
              if (typeof item.product === 'object') {
                const {
                  quantity,
                  product,
                  product: { id, title, meta },
                } = item

                return (
                  <CartItem
                    key={id}
                    product={product}
                    title={title}
                    metaImage={meta?.image}
                    qty={quantity}
                    addItemToCart={addItemToCart}
                  />
                )
              }
              return null
            })}
          </ul>

          <Link href={shopHref} className={classes.continue}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M19 12H5m6 6-6-6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Continue shopping
          </Link>
        </div>

        <aside className={classes.summary} aria-label="Order summary">
          <h2 className={classes.summaryTitle}>Order summary</h2>

          <div className={classes.row}>
            <span>
              Subtotal
              <span className={classes.rowNote}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            </span>
            <span className={classes.rowValue}>{cartTotal.formatted}</span>
          </div>

          <div className={classes.row}>
            <span>Delivery</span>
            <span className={classes.rowFree}>Free</span>
          </div>

          <div className={classes.totalRow}>
            <span>Total</span>
            <span className={classes.totalValue}>{cartTotal.formatted}</span>
          </div>

          <p className={classes.reassurance}>
            This is the final amount. Nothing is added at the next step.
          </p>

          <Link
            href={user ? '/checkout' : '/login?redirect=%2Fcheckout'}
            className={classes.checkoutButton}
          >
            {user ? 'Go to checkout' : 'Sign in to check out'}
          </Link>

          <ul className={classes.trust}>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3l7 3v5.5c0 4.2-2.9 8.1-7 9.5-4.1-1.4-7-5.3-7-9.5V6z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              Secured by Paynow — EcoCash, OneMoney, Visa and Mastercard
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 11a8 8 0 1 1 2.3 5.7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <path d="M4 5v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              30-day returns on everything
            </li>
          </ul>
        </aside>
      </div>
    </Fragment>
  )
}
