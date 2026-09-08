'use client'

// src/app/(admin)/admin/products/ProductsTable.tsx
//
// The products table's column definitions live in a client component
// because `BulkTable` needs them: a column's `render` is a function, and a
// function cannot cross the server/client boundary. The server page fetches
// the rows (plain data) and hands them to this.
//
// Dates arrive as ISO strings rather than `Date` objects for the same
// reason — a `Date` survives the boundary, but formatting it on the server
// would use the server's locale and timezone, not the operator's.

import React from 'react'

import { formatMoney } from '../../../../lib/domain/money'
import { BulkTable } from '../_components/BulkTable'

import classes from '../_components/admin.module.scss'

export interface ProductRow {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  price: number | null
  currency: string | null
  categoryCount: number
  updatedAt: string
}

export const ProductsTable = ({ rows }: { rows: ProductRow[] }) => (
  <BulkTable
    rows={rows}
    noun="product"
    endpoint="/api/admin/products/bulk"
    rowHref={row => `/admin/products/${row.id}`}
    rowLabel={row => row.title}
    emptyMessage="No products yet. Create one, or run `npm run seed:store` to load the demo catalogue."
    actions={[
      { value: 'publish', label: 'Publish' },
      { value: 'unpublish', label: 'Unpublish' },
      { value: 'delete', label: 'Delete', destructive: true },
    ]}
    columns={[
      { header: 'Title', render: row => row.title, isPrimary: true },
      { header: 'Slug', render: row => <code>{row.slug}</code> },
      {
        header: 'Status',
        render: row => (
          <span className={row.status === 'published' ? classes.badgeSuccess : classes.badge}>
            {row.status === 'published' ? 'Published' : 'Draft'}
          </span>
        ),
      },
      {
        header: 'Price',
        render: row =>
          row.price != null && row.currency ? (
            formatMoney({ amount: row.price, currency: row.currency })
          ) : (
            // A product with no price cannot be bought, which is worth
            // flagging in the table rather than printing an em dash.
            <span className={classes.badgeWarning}>Not for sale</span>
          ),
      },
      { header: 'Categories', render: row => row.categoryCount },
      { header: 'Updated', render: row => new Date(row.updatedAt).toLocaleString() },
    ]}
  />
)
