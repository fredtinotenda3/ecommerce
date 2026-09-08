'use client'

// src/app/_components/CartLink/index.tsx
//
// Cart entry point in the header.
//
// The count renders only after the cart has hydrated from local storage or
// the account, which is why it is state rather than read inline: rendering
// a server-side zero and then correcting it produces a hydration mismatch
// and a visible flicker.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

import { useCart } from '../../_providers/Cart'

import classes from './index.module.scss'

export const CartLink: React.FC<{
  className?: string
}> = props => {
  const { className } = props
  const { cart } = useCart()
  const [count, setCount] = useState<number>()

  useEffect(() => {
    setCount(cart?.items?.length || 0)
  }, [cart])

  const label = count && count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'

  return (
    <Link
      className={[classes.cartLink, className].filter(Boolean).join(' ')}
      href="/cart"
      aria-label={label}
    >
      <span className={classes.iconWrap}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 4h2.2l2.1 10.4a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.55L20.5 8H6.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="20" r="1.4" fill="currentColor" />
          <circle cx="17" cy="20" r="1.4" fill="currentColor" />
        </svg>
        {typeof count === 'number' && count > 0 && (
          <span className={classes.badge} aria-hidden="true">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      <span className={classes.label}>Cart</span>
    </Link>
  )
}
