'use client'

// src/app/(pages)/cart/CartItem/index.tsx
//
// One line in the cart.
//
// Three defects fixed here, all reachable by a customer:
//
//   1. The +/- controls were `<div onClick>`. A div is not focusable and
//      not announced as a control, so the quantity could not be changed by
//      keyboard at all, and a screen reader had nothing to operate.
//   2. The quantity field was `<input type="text">` parsed with `Number()`.
//      Typing anything non-numeric produced `NaN`, which was written
//      straight into the cart as the quantity. Input is now parsed
//      defensively and clamped.
//   3. The title was an `<h6>`, putting a level-6 heading directly under
//      the page's `<h1>`. Cart lines are list items, not document
//      sections; the title is a link, not a heading.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

import { Media } from '../../../_components/Media'
import { Price } from '../../../_components/Price'
import { RemoveFromCartButton } from '../../../_components/RemoveFromCartButton'

import classes from './index.module.scss'

/** Matches the product page's cap, so a customer cannot reach a quantity
 * through the cart that they could not have chosen on the product. */
const MAX_QUANTITY = 10

const CartItem = ({ product, title, metaImage, qty, addItemToCart }) => {
  const [quantity, setQuantity] = useState<number>(() => {
    const initial = Number(qty)
    return Number.isFinite(initial) && initial > 0 ? Math.min(initial, MAX_QUANTITY) : 1
  })

  // The cart is the source of truth: if it changes elsewhere (another tab,
  // or a sign-in merging a saved cart) this row follows rather than fights.
  useEffect(() => {
    const next = Number(qty)
    if (Number.isFinite(next) && next > 0) setQuantity(Math.min(next, MAX_QUANTITY))
  }, [qty])

  const commit = (next: number) => {
    const clamped = Math.min(Math.max(next, 1), MAX_QUANTITY)
    setQuantity(clamped)
    addItemToCart({ product, quantity: clamped })
  }

  return (
    <li className={classes.item}>
      <Link href={`/products/${product.slug}`} className={classes.mediaWrapper} tabIndex={-1}>
        {!metaImage && <span className={classes.placeholder}>No image</span>}
        {metaImage && typeof metaImage !== 'string' && (
          <Media
            className={classes.media}
            imgClassName={classes.image}
            resource={metaImage}
            fill
            sizes="120px"
          />
        )}
      </Link>

      <div className={classes.itemDetails}>
        <Link href={`/products/${product.slug}`} className={classes.title}>
          {title}
        </Link>

        <div className={classes.unitPrice}>
          <Price product={product} />
          <span className={classes.unitLabel}>each</span>
        </div>

        <RemoveFromCartButton product={product} className={classes.remove} />
      </div>

      <div className={classes.quantityCell}>
        <span className={classes.cellLabel}>Quantity</span>

        <div className={classes.stepper}>
          <button
            type="button"
            onClick={() => commit(quantity - 1)}
            disabled={quantity <= 1}
            aria-label={`Decrease quantity of ${title}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            aria-label={`Quantity of ${title}`}
            onChange={event => {
              const next = Number.parseInt(event.target.value, 10)
              // An empty or partial entry leaves the field alone rather than
              // writing a nonsense quantity into the cart mid-typing.
              if (Number.isNaN(next)) return
              commit(next)
            }}
          />

          <button
            type="button"
            onClick={() => commit(quantity + 1)}
            disabled={quantity >= MAX_QUANTITY}
            aria-label={`Increase quantity of ${title}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 6v12M6 12h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className={classes.subtotalCell}>
        <span className={classes.cellLabel}>Subtotal</span>
        <Price product={product} quantity={quantity} />
      </div>
    </li>
  )
}

export default CartItem
