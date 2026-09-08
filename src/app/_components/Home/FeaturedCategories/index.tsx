// src/app/_components/Home/FeaturedCategories/index.tsx
//
// The "shop by category" band on the homepage.
//
// Each tile links to the category's own listing using the slug derived from
// its title (`_utilities/categorySlug.ts`), so the URL is readable and
// shareable rather than carrying a Mongo id. The products page resolves
// either form, so a category whose title is later edited still filters
// correctly from the sidebar even if this link stops matching.
//
// Renders nothing when there are no categories — an empty "shop by
// category" heading is worse than no band at all.

import React from 'react'
import Link from 'next/link'

import type { StorefrontCategory } from '../../../_types/storefront'
import { toCategorySlug } from '../../../_utilities/categorySlug'
import { Gutter } from '../../Gutter'
import { Media } from '../../Media'

import classes from './index.module.scss'

export const FeaturedCategories: React.FC<{ categories: StorefrontCategory[] }> = ({
  categories,
}) => {
  const safe = (Array.isArray(categories) ? categories : []).filter(category =>
    Boolean(category.title),
  )

  if (safe.length === 0) return null

  return (
    <section className={classes.section} aria-labelledby="categories-heading">
      <Gutter>
        <div className={classes.header}>
          <div>
            <p className={classes.eyebrow}>Categories</p>
            <h2 id="categories-heading" className={classes.heading}>
              Start with what you need
            </h2>
          </div>
          <Link href="/products" className={classes.seeAll}>
            See everything
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
        </div>

        <ul className={classes.grid}>
          {safe.map(category => {
            const image = category.media
            const href = `/products?category=${encodeURIComponent(
              toCategorySlug(category.title as string),
            )}`

            return (
              <li key={category.id}>
                <Link href={href} className={classes.tile}>
                  <span className={classes.tileMedia}>
                    {image && typeof image !== 'string' ? (
                      <Media resource={image} fill imgClassName={classes.tileImage} />
                    ) : (
                      <span className={classes.tilePlaceholder} aria-hidden="true" />
                    )}
                  </span>
                  <span className={classes.tileTitle}>{category.title}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </Gutter>
    </section>
  )
}
