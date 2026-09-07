// src/app/(pages)/products/Filters/index.tsx
'use client'

import React from 'react'

import type { ProductSort } from '../../../../lib/domain/types'
import { StorefrontCategory } from '../../../_types/storefront'
import { Checkbox } from '../../../_components/Checkbox'
import { HR } from '../../../_components/HR'
import { RadioButton } from '../../../_components/Radio'
import { useFilter } from '../../../_providers/Filter'

import classes from './index.module.scss'

const Filters = ({ categories }: { categories: StorefrontCategory[] }) => {
  const { categoryFilters, sort, setCategoryFilters, setSort } = useFilter()

  const handleCategories = (categoryId: string) => {
    if (categoryFilters.includes(categoryId)) {
      const updatedCategories = categoryFilters.filter(id => id !== categoryId)
      setCategoryFilters(updatedCategories)
    } else {
      setCategoryFilters([...categoryFilters, categoryId])
    }
  }

  const handleSort = (value: string) => setSort(value as ProductSort)

  const safeCategories = Array.isArray(categories) ? categories : []

  return (
    <div className={classes.filters}>
      <div>
        <h6 className={classes.title}>Product Categories</h6>
        <div className={classes.categories}>
          {safeCategories.map(category => {
            const isSelected = categoryFilters.includes(category.id)
            return (
              <Checkbox
                key={category.id}
                label={category.title}
                value={category.id}
                isSelected={isSelected}
                onClickHandler={handleCategories}
              />
            )
          })}
        </div>
        <HR className={classes.hr} />
        <h6 className={classes.title}>Sort By</h6>
        <div className={classes.categories}>
          <RadioButton
            label="Latest"
            value="newest"
            isSelected={sort === 'newest'}
            onRadioChange={handleSort}
            groupName="sort"
          />
          <RadioButton
            label="Oldest"
            value="oldest"
            isSelected={sort === 'oldest'}
            onRadioChange={handleSort}
            groupName="sort"
          />
          <RadioButton
            label="Price: low to high"
            value="price-asc"
            isSelected={sort === 'price-asc'}
            onRadioChange={handleSort}
            groupName="sort"
          />
          <RadioButton
            label="Price: high to low"
            value="price-desc"
            isSelected={sort === 'price-desc'}
            onRadioChange={handleSort}
            groupName="sort"
          />
        </div>
      </div>
    </div>
  )
}

export default Filters
