// src/app/(pages)/[slug]/page.tsx
import React from 'react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import { Page } from '../../../payload/payload-types'
import { staticHome } from '../../../payload/seed/home-static'
import { isNativeRepositoryEnabled } from '../../_api/dataSource'
import { fetchCategoriesNative } from '../../_api/fetchCategoriesNative'
import { fetchDoc } from '../../_api/fetchDoc'
import { fetchDocs } from '../../_api/fetchDocs'
import { fetchPageNative } from '../../_api/fetchPageNative'
import { Blocks } from '../../_components/Blocks'
import { Gutter } from '../../_components/Gutter'
import { Hero } from '../../_components/Hero'
import { StorefrontCategory } from '../../_types/storefront'
import { generateMeta } from '../../_utilities/generateMeta'

export const dynamic = 'force-dynamic'

import Categories from '../../_components/Categories'
import Promotion from '../../_components/Promotion'

import classes from './index.module.scss'

export default async function Page({ params: { slug = 'home' } }) {
  const { isEnabled: isDraftMode } = draftMode()

  let page: Page | null = null
  // PHASE 13G: narrowed from the full `payload-types.ts` `Category[]` —
  // this file only ever reads `categories.length` and passes the array
  // straight through to `<Categories>` (already narrowed to
  // `StorefrontCategory[]` in Phase 13F-B). `Page` is kept — `hero`/
  // `layout` are still CMS discriminated unions with no native
  // equivalent to narrow to.
  let categories: StorefrontCategory[] | null = null

  try {
    page = isNativeRepositoryEnabled()
      ? await fetchPageNative(slug, isDraftMode ? undefined : 'published')
      : await fetchDoc<Page>({
          collection: 'pages',
          slug,
          draft: isDraftMode,
        })

    categories = isNativeRepositoryEnabled()
      ? await fetchCategoriesNative()
      : await fetchDocs<StorefrontCategory>('categories')
  } catch (error) {
    // swallow error - page will use fallback
  }

  if (!page && slug === 'home') {
    page = staticHome
  }

  if (!page) {
    return notFound()
  }

  const { hero, layout } = page

  return (
    <React.Fragment>
      {slug === 'home' ? (
        <section>
          <Hero {...hero} />
          <Gutter className={classes.home}>
            {Array.isArray(categories) && categories.length > 0 && (
              <Categories categories={categories} />
            )}
            <Promotion />
          </Gutter>
        </section>
      ) : (
        <>
          <Hero {...hero} />
          <Blocks
            blocks={layout}
            disableTopPadding={!hero || hero?.type === 'none' || hero?.type === 'lowImpact'}
          />
        </>
      )}
    </React.Fragment>
  )
}

export async function generateStaticParams() {
  try {
    const pages = await fetchDocs<Page>('pages')
    return pages?.map(({ slug }) => slug)
  } catch (error) {
    return []
  }
}

export async function generateMetadata({ params: { slug = 'home' } }): Promise<Metadata> {
  const { isEnabled: isDraftMode } = draftMode()

  let page: Page | null = null

  try {
    page = isNativeRepositoryEnabled()
      ? await fetchPageNative(slug, isDraftMode ? undefined : 'published')
      : await fetchDoc<Page>({
          collection: 'pages',
          slug,
          draft: isDraftMode,
        })
  } catch (error) {
    // swallow
  }

  if (!page && slug === 'home') {
    page = staticHome
  }

  return generateMeta({ doc: page })
}
