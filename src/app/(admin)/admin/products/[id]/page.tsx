// src/app/(admin)/admin/products/[id]/page.tsx
//
// read-only admin product detail. Uses the existing
// ProductRepository via getAdminProductDetailNative; the `Product`
// domain type has no password/auth-internal fields to begin with, so
// nothing needs to be hidden here.

import { notFound } from 'next/navigation'

import { getAdminProductDetailNative } from '../../../../_api/adminQueries'

export const dynamic = 'force-dynamic'

export default async function NativeAdminProductDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const detail = await getAdminProductDetailNative(id)
  if (!detail) notFound()

  const { product, categories } = detail

  return (
    <>
      <h1>{product.title}</h1>
      <dl>
        <dt>Slug</dt>
        <dd>{product.slug}</dd>
        <dt>Status</dt>
        <dd>{product.status}</dd>
        <dt>Price</dt>
        <dd>{product.price != null ? `${product.price} ${product.currency ?? ''}` : 'Not set'}</dd>
        <dt>Compare-at price</dt>
        <dd>{product.compareAtPrice != null ? product.compareAtPrice : '—'}</dd>
        <dt>Categories</dt>
        <dd>{categories.length ? categories.map(c => c.title).join(', ') : 'None'}</dd>
        <dt>Related products</dt>
        <dd>{product.relatedProducts.length}</dd>
        <dt>Paywall enabled</dt>
        <dd>{product.enablePaywall ? 'Yes' : 'No'}</dd>
        <dt>Created</dt>
        <dd>{new Date(product.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(product.updatedAt).toLocaleString()}</dd>
      </dl>
      <h2>Layout / meta (raw)</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
        {JSON.stringify({ layout: product.layout, meta: product.meta }, null, 2)}
      </pre>
    </>
  )
}
