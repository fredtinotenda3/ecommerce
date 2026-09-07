'use client'

// src/app/_components/CollectionArchive/index.tsx
//
// The product grid. Seeds from whatever the server rendered into the block,
// then re-fetches from /api/products so category filters and paging work
// client-side.

import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import type { ArchiveBlockProps } from '../../_blocks/ArchiveBlock/types'
import { useFilter } from '../../_providers/Filter'
import type { StorefrontProductCard } from '../../_types/storefront'
import { Card } from '../Card'
import { PageRange } from '../PageRange'
import { Pagination } from '../Pagination'

import classes from './index.module.scss'

type Result = {
  docs: StorefrontProductCard[]
  page: number
  limit: number
  hasNextPage: boolean
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
  const { categoryFilters } = useFilter()

  const { className, showPageRange, onResultChange, limit = 10, populatedDocs } = props

  const [results, setResults] = useState<Result>({
    docs: (populatedDocs?.map(doc => doc.value) || []) as StorefrontProductCard[],
    page: 1,
    limit,
    hasNextPage: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)

  // A single category id, or none. The filter UI is single-select; sending
  // a list would need the API to support it, which it deliberately does not
  // yet.
  const category = Array.isArray(categoryFilters) ? categoryFilters[0] : categoryFilters

  const loadPage = useCallback(async () => {
    // Only show the loader if the request is slow enough to notice.
    const timer = setTimeout(() => setIsLoading(true), 500)

    try {
      const params = new URLSearchParams({ limit: String(limit), page: String(page) })
      if (category) params.set('category', String(category))

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
  }, [category, limit, page, onResultChange])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  return (
    <div className={[classes.collectionArchive, className].filter(Boolean).join(' ')}>
      <div ref={scrollRef} className={classes.scrollRef} />
      {!isLoading && error && <div>{error}</div>}
      <Fragment>
        {showPageRange !== false && (
          <div className={classes.pageRange}>
            <PageRange
              totalDocs={results.docs.length}
              currentPage={results.page}
              collection="products"
              limit={results.limit}
            />
          </div>
        )}

        <div className={classes.grid}>
          {results.docs?.map(result => (
            <Card key={result.id} relationTo="products" doc={result} showCategories />
          ))}
        </div>

        {(results.hasNextPage || results.page > 1) && (
          <Pagination
            className={classes.pagination}
            page={results.page}
            totalPages={results.hasNextPage ? results.page + 1 : results.page}
            onClick={setPage}
          />
        )}
      </Fragment>
    </div>
  )
}
