// src/app/(native-admin)/native-admin/pages/[id]/page.tsx
//
// PHASE 6 — read-only native admin page detail. Layout/meta/blocks are
// intentionally rendered as raw formatted JSON (per the task) rather
// than reproducing the storefront's Blocks renderer — this is a data
// inspection view, not a live preview.

import { notFound } from 'next/navigation'

import { getAdminPageDetailNative } from '../../../../_api/adminQueries'

export const dynamic = 'force-dynamic'

export default async function NativeAdminPageDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const page = await getAdminPageDetailNative(id)
  if (!page) notFound()

  return (
    <>
      <h1>{page.title}</h1>
      <dl>
        <dt>Slug</dt>
        <dd>{page.slug}</dd>
        <dt>Status</dt>
        <dd>{page.status}</dd>
        <dt>Created</dt>
        <dd>{new Date(page.createdAt).toLocaleString()}</dd>
        <dt>Updated</dt>
        <dd>{new Date(page.updatedAt).toLocaleString()}</dd>
      </dl>
      <h2>Meta</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
        {JSON.stringify(page.meta, null, 2)}
      </pre>
      <h2>Hero</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
        {JSON.stringify(page.hero, null, 2)}
      </pre>
      <h2>Layout (blocks, raw)</h2>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflowX: 'auto' }}>
        {JSON.stringify(page.layout, null, 2)}
      </pre>
    </>
  )
}
