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
            <div className={classes.orderTotal}>
              <p>Order Total</p>
              <p>{cartTotal.formatted}</p>
            </div>
          </ul>
        </div>
      )}
      {!cartIsEmpty && <PaynowCheckoutButton />}
    </Fragment>
  )
}
