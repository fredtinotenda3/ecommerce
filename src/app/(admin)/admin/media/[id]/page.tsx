// src/app/(admin)/admin/media/[id]/page.tsx
//
// Edit a media item's alt text and caption, or delete it.
//
// The file itself cannot be replaced: a new file is a new upload. Swapping
// the bytes behind an existing record would silently change every product
// and page already using it, including ones whose author never saw the new
// image.

import { notFound } from 'next/navigation'
import Link from 'next/link'

import { listAdminMediaNative } from '../../../../_api/adminQueries'
import { AdminForm } from '../../_components/AdminForm'
import { AdminSection } from '../../_components/AdminSection'
import { DeleteButton } from '../../_components/DeleteButton'

export const dynamic = 'force-dynamic'

export default async function AdminMediaDetailPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const media = await listAdminMediaNative(500)
  const item = media.find(entry => entry.id === id)
  if (!item) notFound()

  return (
    <>
      <p>
        <Link href="/admin/media">← Media</Link>
      </p>
      <h1>{item.filename ?? 'Media'}</h1>

      {item.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.alt || ''}
          style={{ maxWidth: 420, height: 'auto', borderRadius: 6, marginBottom: '1rem' }}
        />
      )}

      <dl style={{ color: '#666' }}>
        <dt>URL</dt>
        <dd>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer">
              {item.url}
            </a>
          ) : (
            '—'
          )}
        </dd>
        <dt>Type</dt>
        <dd>{item.mimeType ?? '—'}</dd>
        <dt>Dimensions</dt>
        <dd>{item.width && item.height ? `${item.width}×${item.height}` : 'Unknown'}</dd>
      </dl>

      <AdminSection title="Details">
        <AdminForm
          action={`/api/admin/media/${item.id}`}
          method="PATCH"
          submitLabel="Save media"
          fields={[
            {
              kind: 'text',
              name: 'alt',
              label: 'Alt text',
              defaultValue: item.alt,
              required: true,
              help: 'Describes the image to screen readers and when the image fails to load.',
            },
            {
              kind: 'json',
              name: 'caption',
              label: 'Caption (rich text)',
              defaultValue: [],
              rows: 6,
              help: 'JSON rich-text array, rendered under the image by media blocks and heroes.',
            },
          ]}
        />
      </AdminSection>

      <AdminSection title="Danger zone">
        <DeleteButton
          action={`/api/admin/media/${item.id}`}
          confirmMessage="Delete this file? This removes it from disk as well as the library."
          redirectTo="/admin/media"
          label="Delete media"
        />
      </AdminSection>
    </>
  )
}
