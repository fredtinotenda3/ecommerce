'use client'

// src/app/(admin)/admin/media/MediaTable.tsx
//
// Bulk delete for the media library. Deleting a media record also removes
// the stored file, which is why it confirms and offers no undo — see the
// note in `BulkTable`.

import React from 'react'

import { BulkTable } from '../_components/BulkTable'

import classes from '../_components/admin.module.scss'

export interface MediaRow {
  id: string
  alt: string
  filename: string | null
  mimeType: string | null
  url: string | null
  width: number | null
  height: number | null
  createdAt: string
}

export const MediaTable = ({ rows }: { rows: MediaRow[] }) => (
  <BulkTable
    rows={rows}
    noun="file"
    endpoint="/api/admin/media/bulk"
    rowHref={row => `/admin/media/${row.id}`}
    rowLabel={row => row.filename || row.alt || row.id}
    emptyMessage="No media yet. Upload something above."
    actions={[{ value: 'delete', label: 'Delete', destructive: true }]}
    columns={[
      {
        header: 'Alt text',
        isPrimary: true,
        render: row =>
          row.alt || (
            // Alt text is required for accessibility and is the one field
            // an uploader most often skips, so its absence is flagged.
            <span className={classes.badgeWarning}>No alt text</span>
          ),
      },
      {
        header: 'Preview',
        render: row =>
          row.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.url}
              alt=""
              width={40}
              height={40}
              style={{ height: 40, width: 'auto', borderRadius: 4, display: 'block' }}
              loading="lazy"
            />
          ) : (
            '—'
          ),
      },
      { header: 'Filename', render: row => row.filename ?? '—' },
      { header: 'Type', render: row => row.mimeType ?? '—' },
      {
        header: 'Dimensions',
        render: row => (row.width && row.height ? `${row.width}×${row.height}` : '—'),
      },
      { header: 'Uploaded', render: row => new Date(row.createdAt).toLocaleString() },
    ]}
  />
)
