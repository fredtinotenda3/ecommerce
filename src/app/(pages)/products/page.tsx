// src/app/(pages)/products/page.tsx

import React from 'react'
import { draftMode } from 'next/headers'

import { fetchCategories } from '../../_api/fetchCategories'
import { fetchPage } from '../../_api/fetchPage'
import { Blocks } from '../../_components/Blocks'
import { Gutter } from '../../_components/Gutter'
import { HR } from '../../_components/HR'
import type { StorefrontCategory, StorefrontPage } from '../../_types/storefront'
import Filters from './Filters'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

const Products = async () => {
  const { isEnabled: isDraftMode } = draftMode()

  let page: StorefrontPage | null = null
  let categories: StorefrontCategory[] | null = null

  try {
    page = await fetchPage('products', isDraftMode ? undefined : 'published')
    categories = await fetchCategories()
  } catch (error) {
    console.error('products page read failed:', error) // eslint-disable-line no-console
  }

  return (
    <div className={classes.container}>
      <Gutter className={classes.products}>
        <Filters categories={categories || []} />
        <Blocks blocks={page?.layout} disableTopPadding={true} />
      </Gutter>
      <HR />
    </div>
  )
}

export default Products
