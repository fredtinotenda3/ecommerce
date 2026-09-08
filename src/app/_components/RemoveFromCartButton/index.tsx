'use client'

// src/app/_components/RemoveFromCartButton/index.tsx
//
// Removes a line from the cart, and says which line it removes.
//
// Previously an icon-only button with no accessible name — a screen reader
// announced only "button" — and it rendered the literal string "Item is not
// in the cart" into the page when the product was absent, which is a
// developer note leaking into the storefront. It now renders nothing in
// that case, and confirms the removal with a toast so the change is not
// silent for someone who cannot see the row disappear.

import React from 'react'

import { useCart } from '../../_providers/Cart'
import { useToast } from '../../_providers/Toast'
import { StorefrontCartProduct } from '../../_types/storefront'

import classes from './index.module.scss'

export const RemoveFromCartButton: React.FC<{
  className?: string
  product: StorefrontCartProduct
  /** Renders the word "Remove" beside the icon. */
  showLabel?: boolean
}> = props => {
  const { className, product, showLabel = true } = props

  const { deleteItemFromCart, isProductInCart } = useCart()
  const { showToast } = useToast()

  if (!isProductInCart(product)) return null

  return (
    <button
      type="button"
      onClick={() => {
        deleteItemFromCart(product)
        showToast({
          variant: 'info',
          title: `${product.title} removed from your cart`,
        })
      }}
      className={[className, classes.removeFromCartButton].filter(Boolean).join(' ')}
      aria-label={`Remove ${product.title} from your cart`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showLabel && <span>Remove</span>}
    </button>
  )
}
