// src/app/(admin)/admin/products/[id]/page.tsx
//
// Edit a product: details, pricing and deletion.
//
// Pricing is its own form posting to its own endpoint. That is not a UI
// preference — price is the field that decides what a customer is charged,
// and keeping it off the general edit form means it cannot be changed as a
// side effect of fixing a typo in the description.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import {
  listCategoryOptions,
  listMediaOptions,
  listProductOptions,
  withNoneOption,
} from '../../../../_api/adminOptions'
import { getAdminProductDetailNative } from '../../../../_api/adminQueries'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'
import { DeleteButton } from '../../_components/DeleteButton'
import { PreviewLink } from '../../_components/PreviewLink'

export const dynamic = 'force-dynamic'

const BLOCK_HELP =
  'JSON array of layout blocks. Supported blockType values: "cta", "content", "mediaBlock", "archive".'

export default async function AdminProductDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const detail = await getAdminProductDetailNative(id)
  if (!detail) notFound()

  const { product } = detail
  const [categories, media, otherProducts] = await Promise.all([
    listCategoryOptions(),
    listMediaOptions(),
    listProductOptions(id),
  ])

  return (
    <>
      <p>
        <Link href="/admin/products">← Products</Link>
      </p>
      <h1>{product.title}</h1>
      <p style={{ color: '#666' }}>
        {product.status === 'published' ? (
          <>
            Published —{' '}
            <a href={`/products/${product.slug}`} target="_blank" rel="noreferrer">
              view on the storefront
            </a>
          </>
        ) : (
          <>
            Draft — not visible on the storefront.{' '}
            <PreviewLink path={`/products/${product.slug}`} />
          </>
        )}
      </p>

      <AdminSection title="Details">
        <AdminForm
          action={`/api/admin/products/${product.id}`}
          method="PATCH"
          submitLabel="Save product"
          fields={[
            { kind: 'text', name: 'title', label: 'Title', defaultValue: product.title, required: true },
            { kind: 'slug', name: 'slug', label: 'Slug', defaultValue: product.slug, required: true },
            {
              kind: 'select',
              name: 'status',
              label: 'Status',
              defaultValue: product.status,
              options: [
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
              ],
            },
            {
              kind: 'multiselect',
              name: 'categoryIds',
              label: 'Categories',
              options: categories,
              defaultValue: product.categories,
            },
            {
              kind: 'multiselect',
              name: 'relatedProductIds',
              label: 'Related products',
              options: otherProducts,
              defaultValue: product.relatedProducts,
            },
            {
              kind: 'checkbox',
              name: 'enablePaywall',
              label: 'Gate the paywall content behind a purchase',
              defaultValue: product.enablePaywall,
            },
            {
              kind: 'text',
              name: 'meta.title',
              label: 'SEO title',
              defaultValue: product.meta.title ?? '',
            },
            {
              kind: 'textarea',
              name: 'meta.description',
              label: 'SEO description',
              defaultValue: product.meta.description ?? '',
            },
            {
              kind: 'select',
              name: 'meta.image',
              label: 'SEO / card image',
              options: withNoneOption(media),
              defaultValue: product.meta.imageId ?? '',
              help: 'Also used as the product card image across the storefront.',
            },
            {
              kind: 'json',
              name: 'layout',
              label: 'Layout blocks',
              defaultValue: product.layout,
              help: BLOCK_HELP,
            },
            {
              kind: 'json',
              name: 'paywall',
              label: 'Paywall blocks',
              defaultValue: product.paywall,
              help: 'Shown only to admins and customers who bought this product.',
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Pricing"
        description="Amounts are whole numbers in the currency's minor units — 1999 means 19.99."
      >
        <AdminForm
          action={`/api/admin/products/${product.id}/price`}
          method="PATCH"
          submitLabel="Save price"
          successMessage="Price updated."
          fields={[
            {
              kind: 'number',
              name: 'amount',
              label: 'Price (minor units)',
              defaultValue: product.price,
              required: true,
              min: 0,
            },
            {
              kind: 'text',
              name: 'currency',
              label: 'Currency',
              defaultValue: product.currency ?? 'USD',
              required: true,
              help: 'Three-letter ISO code, uppercase.',
            },
            {
              kind: 'number',
              name: 'compareAtPrice',
              label: 'Compare-at price (optional)',
              defaultValue: product.compareAtPrice,
              min: 0,
              help: 'The struck-through "was" price. Must be higher than the price, or empty.',
            },
          ]}
        />
      </AdminSection>

      <AdminSection title="Danger zone">
        <DeleteButton
          action={`/api/admin/products/${product.id}`}
          confirmMessage={`Delete "${product.title}"? Existing orders keep their own copy of what was sold, but the product page will 404.`}
          redirectTo="/admin/products"
          label="Delete product"
        />
      </AdminSection>
    </>
  )
}
