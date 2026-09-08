'use client'

// src/app/_components/CollectionArchive/index.tsx
//
// The product grid. Seeds from whatever the server rendered into the block,
// then re-fetches from /api/products whenever the filters, sort or page
// change.
//
// Filtering is a union across the selected categories, matching the
// checkbox list in the sidebar: ticking "Boots" and "Hats" shows both, not
// products that are somehow in each. The API takes a repeated `category`
// parameter, so no encoding scheme has to be agreed between the two ends.

import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import type { ArchiveBlockProps } from '../../_blocks/ArchiveBlock/types'
import { useFilter } from '../../_providers/Filter'
import type { StorefrontProductCard } from '../../_types/storefront'
import { Card } from '../Card'
import { EmptyState } from '../EmptyState'
import { PageRange } from '../PageRange'
import { Pagination } from '../Pagination'

import classes from './index.module.scss'

type Result = {
  docs: StorefrontProductCard[]
  page: number
  limit: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export type Props = {
  className?: string
  relationTo?: 'products'
  populateBy?: 'collection' | 'selection'
  showPageRange?: boolean
  onResultChange?: (result: Result) => void
  limit?: number
  populatedDocs?: ArchiveBlockProps['populatedDocs']
  populatedDocsTotal?: ArchiveBlockProps['populatedDocsTotal']
  categories?: ArchiveBlockProps['categories']
}

export const CollectionArchive: React.FC<Props> = props => {
  const { categoryFilters, search, sort } = useFilter()

  const {
    className,
    showPageRange,
    onResultChange,
    limit = 10,
    populatedDocs,
    populatedDocsTotal,
  } = props

  const seeded = (populatedDocs?.map(doc => doc.value) || []) as StorefrontProductCard[]

  const [results, setResults] = useState<Result>({
    docs: seeded,
    page: 1,
    limit,
    total: typeof populatedDocsTotal === 'number' ? populatedDocsTotal : seeded.length,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)

  // Changing the filters while on a later page would otherwise leave the
  // customer on a page number that no longer exists in the new result set.
  const filterKey = `${categoryFilters.join(',')}|${search}|${sort}`
  const lastFilterKey = useRef(filterKey)

  useEffect(() => {
    if (lastFilterKey.current !== filterKey) {
      lastFilterKey.current = filterKey
      setPage(1)
    }
  }, [filterKey])

  const loadPage = useCallback(async () => {
    // Only show the loader if the request is slow enough to notice.
    const timer = setTimeout(() => setIsLoading(true), 500)

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        page: String(page),
        sort,
      })
      for (const categoryId of categoryFilters) {
        params.append('category', categoryId)
      }
      if (search) params.set('q', search)

      const req = await fetch(`/api/products?${params.toString()}`)
      if (!req.ok) throw new Error(`HTTP ${req.status}`)

      const json = (await req.json()) as Result

      if (Array.isArray(json.docs)) {
        setResults(json)
        setError(undefined)
        onResultChange?.(json)
      }
    } catch (err) {
      setError('Unable to load products at this time.')
    } finally {
      clearTimeout(timer)
      setIsLoading(false)
    }
  }, [categoryFilters, limit, page, search, sort, onResultChange])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  return (
    <div className={[classes.collectionArchive, className].filter(Boolean).join(' ')}>
      <div ref={scrollRef} className={classes.scrollRef} />

      {!isLoading && error && (
        <EmptyState
          title="We could not load the products"
          description={error}
          action={{ label: 'Try again', onClick: () => loadPage() }}
          tone="error"
        />
      )}

      <Fragment>
        {showPageRange !== false && !error && (
          <div className={classes.pageRange}>
            <PageRange
              totalDocs={results.total}
              currentPage={results.page}
              collection="products"
              limit={results.limit}
            />
          </div>
        )}

        {/* Skeletons rather than a spinner: the grid keeps its height, so
            the page does not jump when the results land. */}
        {isLoading && (
          <div className={classes.grid} aria-hidden="true">
            {Array.from({ length: Math.min(limit, 6) }).map((_, index) => (
              <div key={index} className={classes.skeletonCard} />
            ))}
          </div>
        )}

        {!isLoading && !error && results.docs.length === 0 && (
          <EmptyState
            title="Nothing matched that"
            description={
              search
                ? `We have nothing matching “${search}”. Try a shorter search, or browse everything we stock.`
                : 'No products match the filters you have selected. Clearing a filter or two should bring some back.'
            }
            action={{ label: 'Browse all products', href: '/products' }}
          />
        )}

        {!isLoading && results.docs.length > 0 && (
          <div className={classes.grid}>
            {results.docs.map(result => (
              <Card key={result.id} relationTo="products" doc={result} showCategories />
            ))}
          </div>
        )}

        {/* A live region so a screen reader hears the result count change
            when filters are applied — the visual PageRange update above is
            silent otherwise. */}
        <p aria-live="polite" className={classes.srStatus}>
          {isLoading
            ? 'Loading products'
            : `${results.total} product${results.total === 1 ? '' : 's'} found`}
        </p>

        {!isLoading && results.totalPages > 1 && (
          <Pagination
            className={classes.pagination}
            page={results.page}
            totalPages={results.totalPages}
            onClick={setPage}
          />
        )}
      </Fragment>
    </div>
  )
}
