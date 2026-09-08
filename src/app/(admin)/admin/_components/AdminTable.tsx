// src/app/(admin)/admin/_components/AdminTable.tsx
//
// The shared table used by every admin listing screen. Leading underscore
// on the directory keeps it out of Next's route resolution (same
// `_components` convention as the storefront).
//
// Presentational and server-renderable. Selection and bulk actions are NOT
// implemented here: a screen that needs them wraps its rows in `BulkTable`,
// which is a client component and passes selection state down through the
// props below. Screens that do not need selection (customers, redirects)
// stay server components shipping no client JavaScript at all.

import type { ReactNode } from 'react'
import Link from 'next/link'

import classes from './admin.module.scss'

export interface AdminTableColumn<Row> {
  header: string
  render: (row: Row) => ReactNode
  /** Set on the column that should carry the link to the record's own
   * page. Defaults to the first column when `rowHref` is given. */
  isPrimary?: boolean
}

export interface AdminTableProps<Row> {
  rows: Row[]
  columns: AdminTableColumn<Row>[]
  rowHref?: (row: Row) => string
  emptyMessage?: string
  /** Supplied by `BulkTable`. Omit for a plain table. */
  selection?: {
    selectedIds: string[]
    onToggle: (id: string) => void
    onToggleAll: () => void
    /** Label for the header checkbox, e.g. "Select all products". */
    label: string
    /** Per-row label, e.g. `row => \`Select ${row.title}\``. */
    rowLabel: (id: string) => string
  }
}

export function AdminTable<Row extends { id: string }>({
  rows,
  columns,
  rowHref,
  emptyMessage = 'Nothing here yet.',
  selection,
}: AdminTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <div className={classes.tableWrap}>
        <p className={classes.empty}>{emptyMessage}</p>
      </div>
    )
  }

  const primaryIndex = Math.max(
    columns.findIndex(column => column.isPrimary),
    0,
  )

  const selectedCount = selection ? selection.selectedIds.length : 0
  const allSelected = selectedCount > 0 && selectedCount === rows.length
  const someSelected = selectedCount > 0 && !allSelected

  return (
    <div className={classes.tableWrap}>
      <table className={classes.table}>
        <thead>
          <tr>
            {selection && (
              <th className={[classes.th, classes.selectCell].join(' ')} scope="col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  // "Some but not all" is a third state; without it the
                  // header box reads as "nothing selected" while rows are.
                  ref={input => {
                    if (input) input.indeterminate = someSelected
                  }}
                  onChange={selection.onToggleAll}
                  aria-label={selection.label}
                />
              </th>
            )}

            {columns.map(column => (
              <th key={column.header} className={classes.th} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map(row => {
            const isSelected = Boolean(selection?.selectedIds.includes(row.id))

            return (
              <tr
                key={row.id}
                className={[classes.row, isSelected && classes.rowSelected]
                  .filter(Boolean)
                  .join(' ')}
              >
                {selection && (
                  <td className={[classes.td, classes.selectCell].join(' ')}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => selection.onToggle(row.id)}
                      aria-label={selection.rowLabel(row.id)}
                    />
                  </td>
                )}

                {columns.map((column, index) => (
                  <td key={column.header} className={classes.td}>
                    {rowHref && index === primaryIndex ? (
                      <Link href={rowHref(row)} className={classes.rowLink}>
                        {column.render(row)}
                      </Link>
                    ) : (
                      column.render(row)
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
