// src/app/(pages)/products/page.tsx
//
// The shop listing. The page itself is a server component: it reads the
// `products` CMS page (for the heading and the SEO metadata) and the
// category list, then hands both to the client-side filter UI.
//
// The query string is the source of truth for what is listed —
// `FilterSync` reads it into the filter provider, so
// `/products?category=laptops` from the navigation and `?q=macbook` from
// the header search box both produce the listing they promise, and the back
// button works.

import React from 'react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'

import { fetchCategories } from '../../_api/fetchCategories'
import { fetchPage } from '../../_api/fetchPage'
import { Blocks } from '../../_components/Blocks'
import { CollectionArchive } from '../../_components/CollectionArchive'
import { Gutter } from '../../_components/Gutter'
import { HR } from '../../_components/HR'
import type { StorefrontCategory, StorefrontPage } from '../../_types/storefront'
import { generateMeta } from '../../_utilities/generateMeta'
import Filters from './Filters'
import FilterSync from './FilterSync'

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

  const safeCategories = categories || []

  return (
    <div className={classes.container}>
      <Gutter>
        <header className={classes.intro}>
          <p className={classes.eyebrow}>Shop</p>
          <h1 className={classes.heading}>{page?.title || 'Everything we stock'}</h1>
          <p className={classes.introCopy}>
            {page?.meta?.description ||
              'Filter by category, sort by price, and check availability before you travel.'}
          </p>
        </header>
      </Gutter>

      <Gutter className={classes.products}>
        <FilterSync categories={safeCategories} />
        <Filters categories={safeCategories} />

        <div className={classes.results}>
          {/* When the CMS page carries layout blocks they render here;
              otherwise the grid is the page. Either way a grid is always
              present, so the shop is never empty merely because an editor
              has not configured a page yet. */}
          {page?.layout && page.layout.length > 0 ? (
            <Blocks blocks={page.layout} disableTopPadding={true} />
          ) : (
            <CollectionArchive limit={12} />
          )}
        </div>
      </Gutter>
      <HR />
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const { isEnabled: isDraftMode } = draftMode()

  let page: StorefrontPage | null = null

  try {
    page = await fetchPage('products', isDraftMode ? undefined : 'published')
  } catch (error) {
    // Fall through to the defaults in `generateMeta`.
  }

  return generateMeta({ doc: page })
}

export default Products
