// src/app/(pages)/[slug]/page.tsx
//
// The CMS-driven page route. Reads directly from MongoDB through the
// repository layer — there is no HTTP hop for storefront reads.
//
// The homepage is a fixed composition rather than a stack of CMS blocks:
// hero, categories, new arrivals, the monthly deal, testimonials and the
// newsletter. That is a deliberate trade. A branded landing page assembled
// from generic blocks looks assembled from generic blocks, and — more
// importantly — a fresh install with an empty `pages` collection would
// otherwise have no homepage at all. The `home` page document still owns
// the title and the SEO metadata, and any layout blocks an editor adds are
// rendered beneath the fixed sections rather than ignored.

import React from 'react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import { fetchCategories } from '../../_api/fetchCategories'
import { fetchPage, fetchPageSlugs } from '../../_api/fetchPage'
import { fetchProducts } from '../../_api/fetchProduct'
import { Blocks } from '../../_components/Blocks'
import { Hero } from '../../_components/Hero'
import { Deals } from '../../_components/Home/Deals'
import { FeaturedCategories } from '../../_components/Home/FeaturedCategories'
import { FeaturedProducts } from '../../_components/Home/FeaturedProducts'
import { HomeHero } from '../../_components/Home/Hero'
import { NewsletterBand } from '../../_components/Home/NewsletterBand'
import { Testimonials } from '../../_components/Home/Testimonials'
import { fallbackHome } from '../../_data/fallbackPages'
import type {
  StorefrontCategory,
  StorefrontPage,
  StorefrontProductCard,
} from '../../_types/storefront'
import { generateMeta } from '../../_utilities/generateMeta'

export const dynamic = 'force-dynamic'

/** Draft mode returns the latest version regardless of status; otherwise
 * only published content is ever read. */
const statusFor = (isDraftMode: boolean): 'draft' | 'published' | undefined =>
  isDraftMode ? undefined : 'published'

export default async function Page({ params: { slug = 'home' } }) {
  const { isEnabled: isDraftMode } = draftMode()
  const isHome = slug === 'home'

  let page: StorefrontPage | null = null
  let categories: StorefrontCategory[] = []
  let newest: StorefrontProductCard[] = []
  let bestValue: StorefrontProductCard[] = []

  try {
    page = await fetchPage(slug, statusFor(isDraftMode))

    // Only the homepage needs the catalogue reads; every other page pays
    // nothing for them.
    if (isHome) {
      const [categoryList, newestPage, cheapestPage] = await Promise.all([
        fetchCategories(),
        fetchProducts({ limit: 4, sort: 'newest' }),
        fetchProducts({ limit: 4, sort: 'price-asc' }),
      ])

      categories = categoryList
      newest = newestPage.docs
      bestValue = cheapestPage.docs
    }
  } catch (error) {
    // Render whatever is available rather than failing the request: a
    // storefront that 500s because one read failed is worse than one that
    // shows fewer sections.
    console.error('page read failed:', error) // eslint-disable-line no-console
  }

  if (!page && isHome) {
    page = fallbackHome
  }

  if (!page) {
    return notFound()
  }

  if (isHome) {
    return (
      <React.Fragment>
        <HomeHero />
        <FeaturedCategories categories={categories} />
        <FeaturedProducts
          id="new-arrivals"
          eyebrow="Just in"
          title="New arrivals"
          href="/products?sort=newest"
          products={newest}
        />
        <Deals />
        <FeaturedProducts
          id="best-value"
          eyebrow="Everyday extras"
          title="Small things worth having"
          href="/products?sort=price-asc"
          products={bestValue}
        />
        <Testimonials />
        <NewsletterBand />

        {/* Anything an editor has added to the `home` page renders last, so
            CMS content extends the branded page rather than competing with
            it. */}
        {page.layout && page.layout.length > 0 && (
          <Blocks blocks={page.layout} disableTopPadding={true} />
        )}
      </React.Fragment>
    )
  }

  const { hero, layout } = page

  return (
    <React.Fragment>
      <Hero {...hero} />
      <Blocks
        blocks={layout}
        disableTopPadding={!hero || hero?.type === 'none' || hero?.type === 'lowImpact'}
      />
    </React.Fragment>
  )
}

export async function generateStaticParams() {
  try {
    // Next expects one object per dynamic segment, not a bare slug list.
    const slugs = await fetchPageSlugs()
    return slugs.filter(Boolean).map(slug => ({ slug }))
  } catch (error) {
    // No database at build time is normal (CI, a fresh clone). The route is
    // `force-dynamic`, so every page is still rendered on request.
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
