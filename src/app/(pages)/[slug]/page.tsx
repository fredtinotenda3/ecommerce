// src/app/(pages)/[slug]/page.tsx
//
// The CMS-driven page route. Reads directly from MongoDB through the
// repository layer — there is no HTTP hop for storefront reads.

import React from 'react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import { fetchCategories } from '../../_api/fetchCategories'
import { fetchPage, fetchPageSlugs } from '../../_api/fetchPage'
import { Blocks } from '../../_components/Blocks'
import { Gutter } from '../../_components/Gutter'
import { Hero } from '../../_components/Hero'
import { fallbackHome } from '../../_data/fallbackPages'
import type { StorefrontCategory, StorefrontPage } from '../../_types/storefront'
import { generateMeta } from '../../_utilities/generateMeta'

export const dynamic = 'force-dynamic'

import Categories from '../../_components/Categories'
import Promotion from '../../_components/Promotion'

import classes from './index.module.scss'

/** Draft mode returns the latest version regardless of status; otherwise
 * only published content is ever read. */
const statusFor = (isDraftMode: boolean): 'draft' | 'published' | undefined =>
  isDraftMode ? undefined : 'published'

export default async function Page({ params: { slug = 'home' } }) {
  const { isEnabled: isDraftMode } = draftMode()

  let page: StorefrontPage | null = null
  let categories: StorefrontCategory[] | null = null

  try {
    page = await fetchPage(slug, statusFor(isDraftMode))
    categories = await fetchCategories()
  } catch (error) {
    // Render the fallback below rather than failing the request outright.
    console.error('page read failed:', error) // eslint-disable-line no-console
  }

  if (!page && slug === 'home') {
    page = fallbackHome
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
    return await fetchPageSlugs()
  } catch (error) {
    return []
  }
}

export async function generateMetadata({ params: { slug = 'home' } }): Promise<Metadata> {
  const { isEnabled: isDraftMode } = draftMode()

  let page: StorefrontPage | null = null

  try {
    page = await fetchPage(slug, statusFor(isDraftMode))
  } catch (error) {
    // Fall through to the fallback below.
  }

  if (!page && slug === 'home') {
    page = fallbackHome
  }

  return generateMeta({ doc: page })
}
