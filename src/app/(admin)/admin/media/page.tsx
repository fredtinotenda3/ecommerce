// src/app/(admin)/admin/media/page.tsx
//
// Media library: upload, browse, and open an item to edit or delete it.

import { listAdminMediaNative } from '../../../_api/adminQueries'
import { AdminTable } from '../_components/AdminTable'
import { MediaUploadForm } from '../_components/MediaUploadForm'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage() {
  const media = await listAdminMediaNative(200)

  return (
    <>
      <h1>Media</h1>

      <MediaUploadForm />

      <AdminTable
        rows={media}
        rowHref={row => `/admin/media/${row.id}`}
        emptyMessage="No media yet. Upload something above."
        columns={[
          { header: 'Alt', render: m => m.alt || '(no alt text)' },
          {
            header: 'Preview',
            render: m =>
              m.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.url}
                  alt={m.alt || ''}
                  style={{ height: 40, width: 'auto', borderRadius: 3 }}
                />
              ) : (
                '—'
              ),
          },
          { header: 'Filename', render: m => m.filename ?? '—' },
          { header: 'Type', render: m => m.mimeType ?? '—' },
          {
            header: 'Dimensions',
            render: m => (m.width && m.height ? `${m.width}×${m.height}` : '—'),
          },
          { header: 'Uploaded', render: m => new Date(m.createdAt).toLocaleString() },
        ]}
      />
    </>
  )
}
