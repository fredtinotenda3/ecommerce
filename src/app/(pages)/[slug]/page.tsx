import React from 'react'
import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import { Category, Page } from '../../../payload/payload-types'
import { staticHome } from '../../../payload/seed/home-static'
import { fetchDoc } from '../../_api/fetchDoc'
import { fetchDocs } from '../../_api/fetchDocs'
import { Blocks } from '../../_components/Blocks'
import { Gutter } from '../../_components/Gutter'
import { Hero } from '../../_components/Hero'
import { generateMeta } from '../../_utilities/generateMeta'

// Payload Cloud caches all files through Cloudflare, so we don't need Next.js to cache them as well
// This means that we can turn off Next.js data caching and instead rely solely on the Cloudflare CDN
// To do this, we include the `no-cache` header on the fetch requests used to get the data for this page
// But we also need to force Next.js to dynamically render this page on each request for preview mode to work
// See https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic
// If you are not using Payload Cloud then this line can be removed
export const dynamic = 'force-dynamic'

import Categories from '../../_components/Categories'
import Promotion from '../../_components/Promotion'

import classes from './index.module.scss'

type Props = {
  params: {
    slug?: string
  }
}

export default async function Page({ params: { slug = 'home' } }: Props) {
  const { isEnabled: isDraftMode } = draftMode()

  let page: Page | null = null
  let categories: Category[] = []

  try {
    page = await fetchDoc<Page>({
      collection: 'pages',
      slug,
      draft: isDraftMode,
    })

    const fetchedCategories = await fetchDocs<Category>('categories')

    if (Array.isArray(fetchedCategories)) {
      categories = fetchedCategories
    }
  } catch (error) {
    console.error('Error fetching page/categories:', error)
  }

  // if no `home` page exists, render a static one using dummy content
  if (!page && slug === 'home') {
    page = staticHome
  }

  if (!page) {
    return notFound()
  }

  const hero = page?.hero || null
  const layout = page?.layout || []

  return (
    <React.Fragment>
      {slug === 'home' ? (
        <section>
          {hero && <Hero {...hero} />}

          <Gutter className={classes.home}>
            <Categories categories={categories} />
            <Promotion />
          </Gutter>
        </section>
      ) : (
        <>
          {hero && <Hero {...hero} />}

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

    if (!Array.isArray(pages)) {
      return []
    }

    return pages.map(({ slug }) => ({
      slug,
    }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

export async function generateMetadata({ params: { slug = 'home' } }: Props): Promise<Metadata> {
  const { isEnabled: isDraftMode } = draftMode()

  let page: Page | null = null

  try {
    page = await fetchDoc<Page>({
      collection: 'pages',
      slug,
      draft: isDraftMode,
    })
  } catch (error) {
    console.error('Error generating metadata:', error)
  }

  if (!page && slug === 'home') {
    page = staticHome
  }

  return generateMeta({ doc: page })
}
