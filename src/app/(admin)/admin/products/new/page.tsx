// src/app/(admin)/admin/products/new/page.tsx
//
// Create a product.
//
// Deliberately a short form: a new product starts as a draft with no
// price, and the fuller edit screen (including pricing) opens as soon as
// it exists. That keeps "create" from being a wall of fields, and means a
// half-filled product cannot be published by accident.

import Link from 'next/link'

import { listCategoryOptions } from '../../../../_api/adminOptions'
import { AdminForm } from '../../_components/AdminForm'

export const dynamic = 'force-dynamic'

export default async function AdminNewProductPage() {
  const categories = await listCategoryOptions()

  return (
    <>
      <p>
        <Link href="/admin/products">← Products</Link>
      </p>
      <h1>New product</h1>

      <AdminForm
        action="/api/admin/products"
        method="POST"
        submitLabel="Create product"
        redirectFrom={body => {
          const product = body.product as { id?: string } | undefined
          return product?.id ? `/admin/products/${product.id}` : '/admin/products'
        }}
        fields={[
          { kind: 'text', name: 'title', label: 'Title', required: true },
          {
            kind: 'slug',
            name: 'slug',
            label: 'Slug',
            required: true,
            help: 'Lowercase words separated by hyphens. Becomes /products/<slug>.',
          },
          {
            kind: 'select',
            name: 'status',
            label: 'Status',
            defaultValue: 'draft',
            options: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ],
            help: 'A product needs a price before it can be bought, whatever its status.',
          },
          {
            kind: 'multiselect',
            name: 'categoryIds',
            label: 'Categories',
            options: categories,
          },
        ]}
      />
    </>
  )
}
