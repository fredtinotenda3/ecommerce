'use client'

// src/app/_components/Card/index.tsx
//
// The product tile used by the shop grid, the related-products row and the
// homepage.
//
// Badges are derived, never stored: "Sale" comes from a compare-at price
// that is genuinely higher than the current one, "New" from the product's
// creation date, and "Unavailable" from the absence of a price — which is
// how this codebase represents "not purchasable" everywhere else (see
// `priceStorefrontAdapter.ts`). Deriving them means a badge can never
// contradict the price printed beneath it.
//
// The whole tile is one link. The badges and the price are inside it, so
// there is exactly one tab stop per product rather than three.

import React from 'react'
import Link from 'next/link'

import type { StorefrontProductCard } from '../../_types/storefront'
import { Media } from '../Media'
import { Price } from '../Price'

import classes from './index.module.scss'

/** A product counts as new for this long after it is created. Long enough
 * to be useful on a slow-moving catalogue, short enough that the badge does
 * not become permanent furniture. */
const NEW_FOR_DAYS = 30

const isNew = (createdAt?: string | null): boolean => {
  if (!createdAt) return false
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return false
  return Date.now() - created < NEW_FOR_DAYS * 24 * 60 * 60 * 1000
}

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  showCategories?: boolean
  hideImagesOnMobile?: boolean
  title?: string
  relationTo?: 'products'
  doc?: StorefrontProductCard
}> = props => {
  const { title: titleFromProps, doc, className } = props

  const { slug, title, meta, price, compareAtPrice, createdAt } = doc || {}
  const { description, image: metaImage } = meta || {}

  const titleToUse = titleFromProps || title
  // Non-breaking spaces come out of rich text editors and break wrapping.
  const sanitizedDescription = description?.replace(/\s/g, ' ')
  const href = `/products/${slug}`

  const isUnavailable = !price
  const isOnSale = Boolean(
    price && compareAtPrice && compareAtPrice.currency === price.currency && compareAtPrice.amount > price.amount,
  )
  const isNewArrival = !isOnSale && isNew(createdAt)

  return (
    <Link href={href} className={[classes.card, className].filter(Boolean).join(' ')}>
      <div className={classes.mediaWrapper}>
        {(isUnavailable || isOnSale || isNewArrival) && (
          <div className={classes.badges}>
            {isUnavailable && <span className={classes.badgeMuted}>Unavailable</span>}
            {isOnSale && <span className={classes.badgeSale}>Sale</span>}
            {isNewArrival && <span className={classes.badgeNew}>New</span>}
          </div>
        )}

        {!metaImage && <div className={classes.placeholder}>No image</div>}
        {metaImage && typeof metaImage !== 'string' && (
          <Media imgClassName={classes.image} resource={metaImage} fill />
        )}
      </div>

      <div className={classes.content}>
        {titleToUse && <h3 className={classes.title}>{titleToUse}</h3>}
        {description && (
          <div className={classes.body}>
            <p className={classes.description}>{sanitizedDescription}</p>
          </div>
        )}

        {doc && !isUnavailable && <Price product={doc} />}
        {isUnavailable && <p className={classes.unavailable}>Currently unavailable</p>}
      </div>
    </Link>
  )
}
