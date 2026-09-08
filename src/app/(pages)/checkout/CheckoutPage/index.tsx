'use client'

// src/app/(pages)/checkout/CheckoutPage/index.tsx
//
// Order review plus the Paynow payment entry point.
//
// The totals shown here are for display only. Paynow checkout starts with a
// POST that carries no body at all: the server re-reads the cart and
// re-derives every price (see /api/checkout/paynow/initiate), so nothing
// rendered on this page can influence what is charged.

import React, { Fragment, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { EmptyState } from '../../../_components/EmptyState'
import { useAuth } from '../../../_providers/Auth'
import { useCart } from '../../../_providers/Cart'
import type { StorefrontSettingsLike } from '../../../_types/storefront'
import { CheckoutItem } from '../CheckoutItem'
import { PaynowCheckoutButton } from '../PaynowCheckoutButton'

import classes from './index.module.scss'

export const CheckoutPage: React.FC<{
  settings: StorefrontSettingsLike | null
}> = props => {
  const productsPage = props.settings?.productsPage

  const { user } = useAuth()
  const router = useRouter()

  const { cart, cartIsEmpty, cartTotal } = useCart()

  useEffect(() => {
    if (user !== null && cartIsEmpty) {
      router.push('/cart')
    }
  }, [router, user, cartIsEmpty])

  if (!user) return null

  return (
    <Fragment>
      {/* Reached only in the instant before the effect above redirects to
          the cart. A designed state rather than a bare sentence, because a
          slow redirect should still look like part of the shop. */}
      {cartIsEmpty && (
        <EmptyState
          title="There is nothing to check out"
          description="Your cart is empty, so there is nothing to pay for yet."
          action={{
            label: 'Browse the shop',
            href:
              typeof productsPage === 'object' && productsPage?.slug
                ? `/${productsPage.slug}`
                : '/products',
          }}
        />
      )}
      {!cartIsEmpty && (
        <div className={classes.items}>
          <div className={classes.header}>
            <p>Item</p>
            <p className={classes.quantity}>Quantity</p>
            <p className={classes.subtotal}>Subtotal</p>
          </div>

          <ul>
            {cart?.items?.map((item, index) => {
              if (typeof item.product !== 'object' || !item.product) return null

              const { quantity, product } = item
              if (!quantity) return null

              return (
                <Fragment key={product.id}>
                  <CheckoutItem
                    product={product}
                    title={product.title}
                    metaImage={product.meta?.image}
                    quantity={quantity}
                    index={index}
                  />
                </Fragment>
              )
            })}
          </ul>

          <div className={classes.totals}>
            <div className={classes.totalsRow}>
              <span>Subtotal</span>
              <span>{cartTotal.formatted}</span>
            </div>
            <div className={classes.totalsRow}>
              <span>Delivery</span>
              <span className={classes.free}>Free</span>
            </div>
            <div className={classes.orderTotal}>
              <span>Order total</span>
              <span className={classes.orderTotalValue}>{cartTotal.formatted}</span>
            </div>
          </div>
        </div>
      )}

      {!cartIsEmpty && (
        <div className={classes.payPanel}>
          <PaynowCheckoutButton />

          <p className={classes.payNote}>
            You will be taken to Paynow to complete payment with EcoCash, OneMoney, Visa or
            Mastercard. Your order is confirmed only once Paynow confirms the payment — we never
            see or store your card details.
          </p>

          <Link href="/cart" className={classes.backToCart}>
            Back to cart
          </Link>
        </div>
      )}
    </Fragment>
  )
}
