// src/app/(pages)/products/page.tsx
import React from 'react'
import { draftMode } from 'next/headers'

import { Page } from '../../../payload/payload-types'
import { isNativeRepositoryEnabled } from '../../_api/dataSource'
import { fetchCategoriesNative } from '../../_api/fetchCategoriesNative'
import { fetchDoc } from '../../_api/fetchDoc'
import { fetchDocs } from '../../_api/fetchDocs'
import { fetchPageNative } from '../../_api/fetchPageNative'
import { Blocks } from '../../_components/Blocks'
import { Gutter } from '../../_components/Gutter'
import { HR } from '../../_components/HR'
import { StorefrontCategory } from '../../_types/storefront'
import Filters from './Filters'

import classes from './index.module.scss'

const Products = async () => {
  const { isEnabled: isDraftMode } = draftMode()

  let page: Page | null = null
  // PHASE 13G: narrowed from the full `payload-types.ts` `Category[]` —
  // this file only ever passes the array straight through to
  // `<Filters>` (already narrowed to `StorefrontCategory[]` in Phase
  // 13F-B). `Page` is kept — `page.layout` is still a CMS discriminated
  // union with no native equivalent to narrow to.
  let categories: StorefrontCategory[] | null = null

  try {
    page = isNativeRepositoryEnabled()
      ? await fetchPageNative('products', isDraftMode ? undefined : 'published')
      : await fetchDoc<Page>({
          collection: 'pages',
          slug: 'products',
          draft: isDraftMode,
        })

    categories = isNativeRepositoryEnabled()
      ? await fetchCategoriesNative()
      : await fetchDocs<StorefrontCategory>('categories')
  } catch (error) {
    console.log(error)
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
