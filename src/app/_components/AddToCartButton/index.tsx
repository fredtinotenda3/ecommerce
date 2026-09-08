'use client'

// src/app/_components/AddToCartButton/index.tsx
//
// Adding to the cart no longer navigates to the cart.
//
// The previous behaviour called `router.push('/cart')` on every add, which
// ends the shopping session at the first item: a customer who wanted two
// things has to find their way back and start browsing again. The
// confirmation is now a toast with a link, so the customer stays where they
// are and decides for themselves when to check out.
//
// A product with no price is not purchasable — the same rule the rest of
// the codebase applies (see `priceStorefrontAdapter`) — so the button is
// disabled and says so, rather than silently adding an unbuyable line to
// the cart.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

import { useCart } from '../../_providers/Cart'
import { useToast } from '../../_providers/Toast'
import { StorefrontCartProduct } from '../../_types/storefront'

import classes from './index.module.scss'

export const AddToCartButton: React.FC<{
  product: StorefrontCartProduct
  quantity?: number
  className?: string
  /** Renders at the larger size used on the product page. */
  size?: 'default' | 'large'
}> = props => {
  const { product, quantity = 1, className, size = 'default' } = props

  const { cart, addItemToCart, isProductInCart, hasInitializedCart } = useCart()
  const { showToast } = useToast()

  const [isInCart, setIsInCart] = useState(false)

  useEffect(() => {
    setIsInCart(isProductInCart(product))
  }, [isProductInCart, product, cart])

  const isPurchasable = Boolean(product?.price)

  if (!isPurchasable) {
    return (
      <button
        type="button"
        className={[classes.button, size === 'large' && classes.large, className]
          .filter(Boolean)
          .join(' ')}
        disabled
      >
        Currently unavailable
      </button>
    )
  }

  const handleAdd = () => {
    addItemToCart({ product, quantity })

    showToast({
      variant: 'success',
      title: `${quantity > 1 ? `${quantity} × ` : ''}${product.title} added to your cart`,
      description: 'Keep browsing, or head to the cart when you are ready.',
    })
  }

  return (
    <div className={[classes.wrap, !hasInitializedCart && classes.hidden].filter(Boolean).join(' ')}>
      <button
        type="button"
        onClick={handleAdd}
        className={[classes.button, size === 'large' && classes.large, className]
          .filter(Boolean)
          .join(' ')}
      >
        {isInCart ? 'Add another' : 'Add to cart'}
      </button>

      {/* Only shown once the item is actually in the cart, so it reads as a
          confirmation rather than a second competing call to action. */}
      {isInCart && (
        <Link href="/cart" className={classes.viewCart}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          In your cart — view cart
        </Link>
      )}
    </div>
  )
}
