'use client'

// src/app/(admin)/admin/categories/CategoriesTable.tsx
//
// Delete is the only bulk action: a category is a title, a parent and an
// image, none of which mean anything applied wholesale.
//
// The endpoint refuses a category that still has products in it, and
// reports that per category, so selecting a mixed set clears out the unused
// ones and tells the operator which are still in use.

import React from 'react'

import { BulkTable } from '../_components/BulkTable'

import classes from '../_components/admin.module.scss'

export interface CategoryRow {
  id: string
  title: string
  parentTitle: string | null
  hasMedia: boolean
  updatedAt: string
}

export const CategoriesTable = ({ rows }: { rows: CategoryRow[] }) => (
  <BulkTable
    rows={rows}
    noun="category"
    endpoint="/api/admin/categories/bulk"
    rowHref={row => `/admin/categories/${row.id}`}
    rowLabel={row => row.title}
    emptyMessage="No categories yet. Create one below."
    actions={[{ value: 'delete', label: 'Delete', destructive: true }]}
    columns={[
      { header: 'Title', render: row => row.title, isPrimary: true },
      { header: 'Parent', render: row => row.parentTitle ?? '—' },
      {
        header: 'Image',
        render: row =>
          row.hasMedia ? (
            <span className={classes.badgeSuccess}>Set</span>
          ) : (
            // Category tiles on the homepage look broken without one, so
            // this is a warning rather than a blank cell.
            <span className={classes.badgeWarning}>Missing</span>
          ),
      },
      { header: 'Updated', render: row => new Date(row.updatedAt).toLocaleString() },
    ]}
  />
)
