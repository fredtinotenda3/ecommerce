'use client'

// src/app/(pages)/products/Filters/index.tsx
//
// The shop sidebar: category facets and a sort order.
//
// Both write to `FilterProvider`, which `CollectionArchive` reads. The URL
// is kept in step by `FilterSync`, so a filtered view is linkable and the
// back button works.
//
// The sidebar is a `<form>` with two `<fieldset>`s rather than a stack of
// divs: that is what makes a screen reader announce "Category, group" as
// the customer arrives at the checkboxes, instead of reading six unrelated
// labels in a row.

import React from 'react'

import type { ProductSort } from '../../../../lib/domain/types'
import { Checkbox } from '../../../_components/Checkbox'
import { RadioButton } from '../../../_components/Radio'
import { useFilter } from '../../../_providers/Filter'
import { StorefrontCategory } from '../../../_types/storefront'

import classes from './index.module.scss'

const SORT_OPTIONS: { label: string; value: ProductSort }[] = [
  { label: 'Newest first', value: 'newest' },
  { label: 'Price: low to high', value: 'price-asc' },
  { label: 'Price: high to low', value: 'price-desc' },
  { label: 'Name: A to Z', value: 'title' },
]

const Filters = ({ categories }: { categories: StorefrontCategory[] }) => {
  const { categoryFilters, search, sort, setCategoryFilters, setSearch, setSort } = useFilter()

  const safeCategories = Array.isArray(categories) ? categories : []

  const toggleCategory = (categoryId: string) => {
    setCategoryFilters(current =>
      current.includes(categoryId)
        ? current.filter(id => id !== categoryId)
        : [...current, categoryId],
    )
  }

  const hasActiveFilters = categoryFilters.length > 0 || Boolean(search)

  return (
    <form className={classes.filters} onSubmit={event => event.preventDefault()}>
      {safeCategories.length > 0 && (
        <fieldset className={classes.group}>
          <legend className={classes.title}>Category</legend>

          <div className={classes.options}>
            {safeCategories.map(category => (
              <Checkbox
                key={category.id}
                label={category.title || 'Untitled'}
                value={category.id}
                isSelected={categoryFilters.includes(category.id)}
                onClickHandler={toggleCategory}
              />
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className={classes.group}>
        <legend className={classes.title}>Sort by</legend>

        <div className={classes.options}>
          {SORT_OPTIONS.map(option => (
            <RadioButton
              key={option.value}
              label={option.label}
              value={option.value}
              isSelected={sort === option.value}
              onRadioChange={value => setSort(value as ProductSort)}
              groupName="sort"
            />
          ))}
        </div>
      </fieldset>

      {/* Only rendered when there is something to clear, so it never sits
          there as a dead control. */}
      {hasActiveFilters && (
        <button
          type="button"
          className={classes.clear}
          onClick={() => {
            setCategoryFilters([])
            setSearch('')
          }}
        >
          Clear filters
          {search && <span className={classes.clearNote}>including “{search}”</span>}
        </button>
      )}
    </form>
  )
}

export default Filters
