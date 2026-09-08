// src/app/(admin)/admin/media/page.tsx
//
// Media library: upload, browse, and open an item to edit or delete it.

import { listAdminMediaNative } from '../../../_api/adminQueries'
import { MediaUploadForm } from '../_components/MediaUploadForm'
import { MediaTable, type MediaRow } from './MediaTable'

import classes from '../_components/admin.module.scss'

export const dynamic = 'force-dynamic'

export default async function AdminMediaPage() {
  const media = await listAdminMediaNative(200)

  const rows: MediaRow[] = media.map(item => ({
    id: item.id,
    alt: item.alt,
    filename: item.filename,
    mimeType: item.mimeType,
    url: item.url,
    width: item.width,
    height: item.height,
    createdAt: new Date(item.createdAt).toISOString(),
  }))

  const missingAlt = rows.filter(row => !row.alt).length

  return (
    <>
      <div className={classes.pageHeader}>
        <div>
          <h1 className={classes.pageTitle}>Media</h1>
          <p className={classes.pageSubtitle}>
            {rows.length} files
            {missingAlt > 0 ? `, ${missingAlt} without alt text` : ''}. Deleting a file removes it
            from disk as well as from the library.
          </p>
        </div>
      </div>

      <MediaUploadForm />

      <MediaTable rows={rows} />
    </>
  )
}
