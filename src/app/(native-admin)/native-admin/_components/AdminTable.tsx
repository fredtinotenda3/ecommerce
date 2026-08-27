// src/app/(native-admin)/native-admin/_components/AdminTable.tsx
//
// PHASE 6 — tiny shared table renderer for the native admin listing
// pages. Leading underscore keeps this out of Next's route resolution
// (same `_components` convention used by the storefront, see
// src/app/_components). Deliberately minimal — this is a foundation for
// a future native admin, not a styled UI.

import type { ReactNode } from 'react'
import Link from 'next/link'

export interface AdminTableColumn<Row> {
  header: string
  render: (row: Row) => ReactNode
}

export interface AdminTableProps<Row> {
  rows: Row[]
  columns: AdminTableColumn<Row>[]
  rowHref?: (row: Row) => string
  emptyMessage?: string
}

export function AdminTable<Row extends { id: string }>({
  rows,
  columns,
  rowHref,
  emptyMessage = 'No results.',
}: AdminTableProps<Row>) {
  if (rows.length === 0) {
    return <p style={{ color: '#666' }}>{emptyMessage}</p>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {columns.map(col => (
            <th
              key={col.header}
              style={{ textAlign: 'left', borderBottom: '2px solid #ccc', padding: '0.5rem' }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
            {columns.map(col => (
              <td key={col.header} style={{ padding: '0.5rem' }}>
                {rowHref ? (
                  col === columns[0] ? (
                    <Link href={rowHref(row)}>{col.render(row)}</Link>
                  ) : (
                    col.render(row)
                  )
                ) : (
                  col.render(row)
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
