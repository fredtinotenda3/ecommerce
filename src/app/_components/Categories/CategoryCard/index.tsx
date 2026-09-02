'use client'
import React from 'react'
import Link from 'next/link'

import { StorefrontCategory } from '../../../_types/storefront'
import { useFilter } from '../../../_providers/Filter'

import classes from './index.module.scss'

type CategoryCardProps = {
  // PHASE 13F-B: narrowed from the full `payload-types.ts` `Category` —
  // this component only ever reads `id`/`title`/`media.url` (see
  // StorefrontCategory's doc comment in src/app/_types/storefront.ts).
  // Every existing caller already passes a real `Category`, which
  // satisfies this narrower shape unchanged.
  category: StorefrontCategory
}

const CategoryCard = ({ category }: CategoryCardProps) => {
  const media = category.media
  const mediaUrl = media && typeof media === 'object' ? media.url : undefined
  const { setCategoryFilters } = useFilter()

  return (
    <Link
      href="/products"
      className={classes.card}
      style={{ backgroundImage: mediaUrl ? `url(${mediaUrl})` : undefined }}
      onClick={() => setCategoryFilters([category.id])}
    >
      <p className={classes.title}>{category.title}</p>
    </Link>
  )
}

export default CategoryCard
