'use client'

// src/app/(pages)/products/FilterSync/index.tsx
//
// Makes the URL the source of truth for the product listing.
//
// The filter sidebar keeps its state in `FilterProvider`, which is fine
// while the customer is on the page but leaves three things broken:
//
//   - a navigation link like `/products?category=laptops` shows the whole
//     catalogue, because nothing reads the query string;
//   - the header search box submits `?q=…` to a page that ignores it;
//   - the back button appears to do nothing.
//
// This component renders nothing. It reads the query string and writes it
// into the provider on mount and on every subsequent URL change, so a link,
// a bookmark and a back-navigation all produce the same listing.
//
// Category tokens may be ids (what the checkboxes submit) or slugs derived
// from category titles (what the hand-written navigation links use); the
// mapping needs the category list, which the server component already has,
// so it is passed in rather than fetched again.

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import type { ProductSort } from '../../../../lib/domain/types'
import { useFilter } from '../../../_providers/Filter'
import type { StorefrontCategory } from '../../../_types/storefront'
import { resolveCategoryTokens } from '../../../_utilities/categorySlug'

const VALID_SORTS: ProductSort[] = ['newest', 'oldest', 'price-asc', 'price-desc', 'title']

const FilterSync = ({ categories }: { categories: StorefrontCategory[] }) => {
  const searchParams = useSearchParams()
  const { setCategoryFilters, setSearch, setSort } = useFilter()

  // `searchParams` is a new object on every render, so the effect keys on
  // its serialised form instead — otherwise this would loop.
  const queryString = searchParams?.toString() ?? ''

  useEffect(() => {
    const params = new URLSearchParams(queryString)

    const tokens = params
      .getAll('category')
      .flatMap(value => value.split(','))
      .map(value => value.trim())
      .filter(Boolean)

    setCategoryFilters(resolveCategoryTokens(tokens, categories))
    setSearch((params.get('q') || '').trim())

    const sort = params.get('sort')
    if (sort && VALID_SORTS.includes(sort as ProductSort)) setSort(sort as ProductSort)
    // `categories` is stable for the lifetime of the page (it is server
    // rendered), and the setters are stable state dispatchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  return null
}

export default FilterSync
