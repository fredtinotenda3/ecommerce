// src/app/_components/Home/FeaturedProducts/index.tsx
//
// A row of products on the homepage, rendered from data the page has
// already fetched server-side — no client fetch, no loading state, and no
// empty grid while the request is in flight.
//
// Renders nothing when there is nothing to show, so a homepage on a
// database with no published products degrades to the rest of the page
// rather than to an empty band with a heading over it.

import React from 'react'
import Link from 'next/link'

import type { StorefrontProductCard } from '../../../_types/storefront'
import { Card } from '../../Card'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

export interface FeaturedProductsProps {
  products: StorefrontProductCard[]
  title: string
  eyebrow: string
  /** Where "see all" points. Omit to hide the link. */
  href?: string
  /** Optional supporting line under the heading. */
  lede?: string
  id: string
}

export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  products,
  title,
  eyebrow,
  href,
  lede,
  id,
}) => {
  if (!Array.isArray(products) || products.length === 0) return null

  return (
    <section className={classes.section} aria-labelledby={`${id}-heading`}>
      <Gutter>
        <div className={classes.header}>
          <div>
            <p className={classes.eyebrow}>{eyebrow}</p>
            <h2 id={`${id}-heading`} className={classes.heading}>
              {title}
            </h2>
            {lede && <p className={classes.lede}>{lede}</p>}
          </div>

          {href && (
            <Link href={href} className={classes.seeAll}>
              See all
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12h14m-6-6 6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          )}
        </div>

        <div className={classes.grid}>
          {products.map(product => (
            <Card key={product.id} relationTo="products" doc={product} />
          ))}
        </div>
      </Gutter>
    </section>
  )
}
