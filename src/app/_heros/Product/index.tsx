'use client'

// src/app/_heros/Product/index.tsx
//
// The product page's buying panel: image, identity, price, quantity, the
// purchase action, and the reassurance a customer needs to press it.
//
// Client-side only because of the quantity stepper. Everything else here is
// static, and the surrounding page (`(pages)/products/[slug]`) remains a
// server component.
//
// Two honesty fixes, both of which were live problems:
//
//   - The panel printed "In stock" for every product unconditionally. There
//     is no stock model in this application, so that was a claim the system
//     could not support and could not keep. Availability is now derived
//     from the only fact that exists — whether the product has an
//     authoritative price, which is what makes it purchasable — and worded
//     to say that much and no more.
//   - The title was an <h3> on a page with no <h1>. A product page's
//     heading is the product.

import React, { useState } from 'react'
import Link from 'next/link'

import { AddToCartButton } from '../../_components/AddToCartButton'
import { Gutter } from '../../_components/Gutter'
import { Media } from '../../_components/Media'
import { Price } from '../../_components/Price'
import {
  StorefrontMediaItem,
  StorefrontProductCategoryRef,
  StorefrontProductHeroView,
} from '../../_types/storefront'
import { toCategorySlug } from '../../_utilities/categorySlug'

import classes from './index.module.scss'

type ProductHeroProduct = Omit<StorefrontProductHeroView, 'meta'> & {
  meta?: {
    image?: string | StorefrontMediaItem
    description?: string | null
  } | null
}

/** The promises that matter at the moment of purchase. Deliberately the
 * same ones the rest of the site makes — a product page that invents its
 * own guarantees is how a shop ends up unable to honour them. */
const ASSURANCES = [
  { label: 'Free delivery over $150', detail: 'Next day across Zimbabwe' },
  { label: 'Two-year warranty', detail: 'On top of the manufacturer cover' },
  { label: '30-day returns', detail: 'Unused and in its packaging' },
]

const MAX_QUANTITY = 10

export const ProductHero: React.FC<{ product: ProductHeroProduct }> = ({ product }) => {
  const { title, categories, meta: { image: metaImage, description } = {} } = product

  const [quantity, setQuantity] = useState(1)

  const isPurchasable = Boolean(product?.price)

  const categoryRefs = (categories || []).filter(
    (category): category is StorefrontProductCategoryRef =>
      typeof category !== 'string' && Boolean(category?.title),
  )

  const primaryCategory = categoryRefs[0]

  return (
    <Gutter>
      <nav className={classes.breadcrumb} aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li aria-hidden="true" className={classes.crumbSep}>
            /
          </li>
          <li>
            <Link href="/products">Shop</Link>
          </li>
          {primaryCategory && (
            <React.Fragment>
              <li aria-hidden="true" className={classes.crumbSep}>
                /
              </li>
              <li>
                <Link
                  href={`/products?category=${encodeURIComponent(
                    toCategorySlug(primaryCategory.title as string),
                  )}`}
                >
                  {primaryCategory.title}
                </Link>
              </li>
            </React.Fragment>
          )}
          <li aria-hidden="true" className={classes.crumbSep}>
            /
          </li>
          <li aria-current="page" className={classes.crumbCurrent}>
            {title}
          </li>
        </ol>
      </nav>

      <div className={classes.productHero}>
        <div className={classes.mediaColumn}>
          <div className={classes.mediaWrapper}>
            {!metaImage && <div className={classes.placeholder}>Image coming soon</div>}
            {metaImage && typeof metaImage !== 'string' && (
              <Media
                imgClassName={classes.image}
                resource={metaImage}
                fill
                priority
                quality={90}
                sizes="(max-width: 1024px) 92vw, 50vw"
              />
            )}
          </div>
        </div>

        <div className={classes.details}>
          {categoryRefs.length > 0 && (
            <p className={classes.eyebrow}>
              {categoryRefs.map(category => category.title).join(' · ')}
            </p>
          )}

          <h1 className={classes.title}>{title}</h1>

          {description && <p className={classes.summary}>{description}</p>}

          <div className={classes.priceBlock}>
            <Price product={product} />
          </div>

          <p className={isPurchasable ? classes.available : classes.unavailable}>
            <span className={classes.availableDot} aria-hidden="true" />
            {isPurchasable
              ? 'Available to order — ships within one working day'
              : 'Not currently available to order'}
          </p>

          {isPurchasable ? (
            <div className={classes.buyRow}>
              <div className={classes.quantity}>
                <label htmlFor="product-quantity" className={classes.quantityLabel}>
                  Qty
                </label>

                <div className={classes.stepper}>
                  <button
                    type="button"
                    onClick={() => setQuantity(current => Math.max(1, current - 1))}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M6 12h12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>

                  {/* A real input, not a display span: someone buying eight
                      of something should be able to type 8. */}
                  <input
                    id="product-quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_QUANTITY}
                    value={quantity}
                    onChange={event => {
                      const next = Number.parseInt(event.target.value, 10)
                      if (Number.isNaN(next)) return
                      setQuantity(Math.min(Math.max(next, 1), MAX_QUANTITY))
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity(current => Math.min(MAX_QUANTITY, current + 1))}
                    disabled={quantity >= MAX_QUANTITY}
                    aria-label="Increase quantity"
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

              <AddToCartButton
                product={product}
                quantity={quantity}
                size="large"
                className={classes.addToCartButton}
              />
            </div>
          ) : (
            <AddToCartButton product={product} size="large" className={classes.addToCartButton} />
          )}

          <ul className={classes.assurances}>
            {ASSURANCES.map(assurance => (
              <li key={assurance.label}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  <strong>{assurance.label}</strong>
                  <span className={classes.assuranceDetail}>{assurance.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Gutter>
  )
}
