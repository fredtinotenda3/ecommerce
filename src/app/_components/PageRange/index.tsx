import React from 'react'

import classes from './index.module.scss'

const defaultLabels = { singular: 'result', plural: 'results' }

const defaultCollectionLabels: Record<string, { singular: string; plural: string }> = {
  products: { singular: 'product', plural: 'products' },
}

/**
 * "Showing 1–12 of 15 products".
 *
 * Lower-case nouns and an en dash, because this is a sentence rather than a
 * label; the empty case now says what to do about it rather than reporting
 * a search that may not have happened ("Search produced no results" appeared
 * whenever a filter matched nothing, including on first load).
 */
export const PageRange: React.FC<{
  className?: string
  totalDocs?: number
  currentPage?: number
  collection?: string
  limit?: number
  collectionLabels?: { singular?: string; plural?: string }
}> = props => {
  const {
    className,
    totalDocs,
    currentPage,
    collection,
    limit,
    collectionLabels: collectionLabelsFromProps,
  } = props

  const perPage = limit || 1
  const indexStart = (currentPage ? currentPage - 1 : 0) * perPage + 1
  const indexEnd = Math.min((currentPage || 1) * perPage, totalDocs ?? 0)

  const { singular, plural } = {
    ...(defaultCollectionLabels[collection || ''] || defaultLabels),
    ...collectionLabelsFromProps,
  }

  if (!totalDocs) return null

  return (
    <p className={[className, classes.pageRange].filter(Boolean).join(' ')}>
      Showing <strong>{indexStart}</strong>–<strong>{indexEnd}</strong> of {totalDocs}{' '}
      {totalDocs === 1 ? singular : plural}
    </p>
  )
}
