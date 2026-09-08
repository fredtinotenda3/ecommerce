// src/app/(admin)/admin/products/page.tsx
//
// Products list. Access is enforced by the route group's layout.
//
// This stays a server component: it reads the catalogue and hands plain,
// serialisable rows to `ProductsTable`, which owns the client-side
// selection and bulk actions.

import Link from 'next/link'

import { listAdminProductsNative } from '../../../_api/adminQueries'
import { ProductsTable, type ProductRow } from './ProductsTable'

import classes from '../_components/admin.module.scss'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
  const products = await listAdminProductsNative({ limit: 200 })

  const rows: ProductRow[] = products.map(product => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    status: product.status,
    price: product.price,
    currency: product.currency,
    categoryCount: product.categoryIds.length,
    updatedAt: new Date(product.updatedAt).toISOString(),
  }))

  const published = rows.filter(row => row.status === 'published').length

  return (
    <>
      <div className={classes.pageHeader}>
        <div>
          <h1 className={classes.pageTitle}>Products</h1>
          <p className={classes.pageSubtitle}>
            {rows.length} total, {published} published. Select rows to publish, unpublish or delete
            several at once.
          </p>
        </div>
        <Link href="/admin/products/new" className={classes.buttonPrimary}>
          New product
        </Link>
      </div>

      <ProductsTable rows={rows} />
    </>
  )
}
