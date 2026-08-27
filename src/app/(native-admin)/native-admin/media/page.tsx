// src/app/(native-admin)/native-admin/media/page.tsx
//
// PHASE 6 — read-only native admin media list. No detail page requested
// for media in Phase 6 scope.

import { listAdminMediaNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'

export const dynamic = 'force-dynamic'

export default async function NativeAdminMediaPage() {
  const media = await listAdminMediaNative()

  return (
    <>
      <h1>Media</h1>
      <AdminTable
        rows={media}
        columns={[
          { header: 'Alt', render: m => m.alt },
          { header: 'Filename', render: m => m.filename ?? '—' },
          { header: 'MIME type', render: m => m.mimeType ?? '—' },
          {
            header: 'Dimensions',
            render: m => (m.width && m.height ? `${m.width}×${m.height}` : '—'),
          },
          {
            header: 'URL',
            render: m =>
              m.url ? (
                <a href={m.url} target="_blank" rel="noreferrer">
                  {m.url}
                </a>
              ) : (
                '—'
              ),
          },
          { header: 'Created', render: m => new Date(m.createdAt).toLocaleString() },
        ]}
      />
    </>
  )
}
