'use client'

// src/app/(admin)/admin/_components/BulkTable.tsx
//
// Selection state and the bulk action bar, wrapped around `AdminTable`.
//
// Behaviour worth stating explicitly:
//
//   - A destructive action confirms first, naming the count and the fact
//     that it cannot be undone. Nothing else confirms; a confirmation on a
//     reversible action trains people to dismiss confirmations.
//
//   - There is no undo. Offering one would mean either soft-deleting (a
//     schema and query change across every collection) or replaying a
//     delete in reverse, which cannot restore a media file that has already
//     been removed from disk. A confirmation the operator reads is honest;
//     an "undo" that silently fails is not.
//
//   - The response is a PER-ITEM report, so the toast says "9 published, 1
//     failed" and the failures are listed with their reasons rather than
//     collapsed into "something went wrong".
//
//   - `router.refresh()` re-reads the server component's data after a
//     successful batch, so the table reflects the change without a full
//     page load and without this component keeping a second copy of the
//     rows in state.

import React, { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '../../../_providers/Toast'
import { AdminTable, type AdminTableColumn } from './AdminTable'

import classes from './admin.module.scss'

interface BulkItemResult {
  id: string
  ok: boolean
  error?: string
}

interface BulkResponseBody {
  results: BulkItemResult[]
  succeeded: number
  failed: number
}

export interface BulkAction {
  /** Value sent as `action` to the endpoint. */
  value: string
  label: string
  /** Confirms before running, and renders in the danger style. */
  destructive?: boolean
}

export interface BulkTableProps<Row extends { id: string }> {
  rows: Row[]
  columns: AdminTableColumn<Row>[]
  rowHref?: (row: Row) => string
  emptyMessage?: string
  /** The bulk endpoint, e.g. `/api/admin/products/bulk`. */
  endpoint: string
  actions: BulkAction[]
  /** Singular noun for messages, e.g. "product". */
  noun: string
  /** Human label for a row, used by the row checkbox's accessible name. */
  rowLabel: (row: Row) => string
}

export function BulkTable<Row extends { id: string }>({
  rows,
  columns,
  rowHref,
  emptyMessage,
  endpoint,
  actions,
  noun,
  rowLabel,
}: BulkTableProps<Row>) {
  const router = useRouter()
  const { showToast } = useToast()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const labelsById = useMemo(() => {
    const map = new Map<string, string>()
    rows.forEach(row => map.set(row.id, rowLabel(row)))
    return map
  }, [rows, rowLabel])

  const toggle = useCallback((id: string) => {
    setSelectedIds(current =>
      current.includes(id) ? current.filter(entry => entry !== id) : [...current, id],
    )
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds(current => (current.length === rows.length ? [] : rows.map(row => row.id)))
  }, [rows])

  const plural = useCallback(
    (count: number): string => `${count} ${noun}${count === 1 ? '' : 's'}`,
    [noun],
  )

  const run = useCallback(
    async (action: BulkAction) => {
      if (selectedIds.length === 0) return

      if (action.destructive) {
        const confirmed = window.confirm(
          `${action.label} ${plural(selectedIds.length)}?\n\nThis cannot be undone.`,
        )
        if (!confirmed) return
      }

      setPendingAction(action.value)

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Same-origin credentials carry the session cookie; the endpoint
          // 404s without an admin session.
          credentials: 'same-origin',
          body: JSON.stringify({ action: action.value, ids: selectedIds }),
        })

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error || `The server rejected the request (${response.status}).`)
        }

        const report = (await response.json()) as BulkResponseBody

        const failures = report.results.filter(result => !result.ok)

        if (failures.length === 0) {
          showToast({
            variant: 'success',
            title: `${action.label}: ${plural(report.succeeded)}`,
          })
        } else {
          // Name the records that failed and why. A count on its own leaves
          // the operator to work out which of forty rows did not apply.
          const detail = failures
            .slice(0, 3)
            .map(failure => `${labelsById.get(failure.id) ?? failure.id}: ${failure.error}`)
            .join('; ')

          showToast({
            variant: report.succeeded > 0 ? 'info' : 'error',
            title: `${report.succeeded} succeeded, ${failures.length} failed`,
            description:
              failures.length > 3 ? `${detail}; and ${failures.length - 3} more.` : detail,
          })
        }

        // Anything that succeeded is no longer in the state the selection
        // assumed, so the selection is cleared rather than left pointing at
        // deleted records.
        setSelectedIds([])
        router.refresh()
      } catch (error: unknown) {
        showToast({
          variant: 'error',
          title: 'That action did not run',
          description: error instanceof Error ? error.message : 'Please try again.',
        })
      } finally {
        setPendingAction(null)
      }
    },
    [endpoint, labelsById, plural, router, selectedIds, showToast],
  )

  const isBusy = pendingAction !== null

  return (
    <React.Fragment>
      {selectedIds.length > 0 && (
        <div className={classes.bulkBar} role="region" aria-label="Bulk actions">
          <span className={classes.bulkCount}>{plural(selectedIds.length)} selected</span>

          <span className={classes.bulkSpacer} />

          {actions.map(action => (
            <button
              key={action.value}
              type="button"
              className={action.destructive ? classes.buttonDanger : classes.button}
              onClick={() => run(action)}
              disabled={isBusy}
            >
              {pendingAction === action.value ? 'Working…' : action.label}
            </button>
          ))}

          <button
            type="button"
            className={classes.button}
            onClick={() => setSelectedIds([])}
            disabled={isBusy}
          >
            Clear
          </button>
        </div>
      )}

      <AdminTable
        rows={rows}
        columns={columns}
        rowHref={rowHref}
        emptyMessage={emptyMessage}
        selection={{
          selectedIds,
          onToggle: toggle,
          onToggleAll: toggleAll,
          label: `Select all ${noun}s on this page`,
          rowLabel: id => `Select ${labelsById.get(id) ?? id}`,
        }}
      />
    </React.Fragment>
  )
}
