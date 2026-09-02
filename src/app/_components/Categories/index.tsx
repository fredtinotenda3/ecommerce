// src/app/_components/Categories/index.tsx
import React from 'react'
import Link from 'next/link'

import { StorefrontCategory } from '../../_types/storefront'
import CategoryCard from './CategoryCard'

import classes from './index.module.scss'

// PHASE 13F-B: narrowed from `payload-types.ts`'s `Category[]` — see
// StorefrontCategory's doc comment in src/app/_types/storefront.ts.
// Every existing caller already passes a real `Category[]`, which
// satisfies this narrower shape unchanged.
const Categories = ({ categories }: { categories: StorefrontCategory[] }) => {
  const safeCategories = Array.isArray(categories) ? categories : []

  if (safeCategories.length === 0) return null

  return (
    <section className={classes.container}>
      <div className={classes.titleWrapper}>
        <h3>Shop by Categories</h3>
        <Link href="/products">Show All</Link>
      </div>

      <div className={classes.list}>
        {safeCategories.map(category => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </section>
  )
}

export default Categories
