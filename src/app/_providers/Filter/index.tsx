'use client'

// src/app/_providers/Filter/index.tsx
//
// Product-listing filter state, shared between the Filters sidebar and the
// CollectionArchive grid.
//
// `sort` uses the same tokens the products API accepts, so the value is
// passed straight through rather than translated in the middle — a
// translation layer is where the two ends drift apart.

import { createContext, SetStateAction, useContext, useState } from 'react'

import type { ProductSort } from '../../../lib/domain/types'

interface IContextType {
  categoryFilters: string[]
  setCategoryFilters: React.Dispatch<SetStateAction<string[]>>
  /** Free-text term from the header search box. Empty string means "no
   * search", which is distinct from a search that matched nothing. */
  search: string
  setSearch: React.Dispatch<SetStateAction<string>>
  sort: ProductSort
  setSort: React.Dispatch<SetStateAction<ProductSort>>
}

export const INITIAL_FILTER_DATA: IContextType = {
  categoryFilters: [],
  setCategoryFilters: () => [],
  search: '',
  setSearch: () => undefined,
  sort: 'newest',
  setSort: () => undefined,
}

const FilterContext = createContext<IContextType>(INITIAL_FILTER_DATA)

export const FilterProvider = ({ children }: { children: React.ReactNode }) => {
  const [categoryFilters, setCategoryFilters] = useState<string[]>([])
  const [search, setSearch] = useState<string>('')
  const [sort, setSort] = useState<ProductSort>('newest')

  return (
    <FilterContext.Provider
      value={{
        categoryFilters,
        setCategoryFilters,
        search,
        setSearch,
        sort,
        setSort,
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export const useFilter = (): IContextType => useContext(FilterContext)
