// src/app/api/admin/_shared/bulk.ts
//
// Shared plumbing for the admin bulk endpoints.
//
// Design notes, because the shape is deliberate:
//
//   1. A bulk operation applies the SAME single-item mutation the rest of
//      the admin API uses, once per id. It does not reach past the service
//      layer to issue one wide `updateMany`. That is slower, and it is the
//      right trade: every validation rule (a category must be empty before
//      it is deleted, an order status transition must be legal, a media
//      record owns a file on disk) lives in those mutations. A bulk path
//      with its own query would silently bypass all of them.
//
//   2. Items are applied SEQUENTIALLY. Fanning fifty deletes at a database
//      pool sized for a web request is how an admin action takes the
//      storefront down with it.
//
//   3. One failure does not abort the batch, and it does not fail the
//      request. Each item reports its own outcome, and the response is a
//      per-item report the UI renders as "9 published, 1 failed: …".
//      Aborting on the first error would leave the operator with a
//      partially applied change and no record of which half applied.
//
//   4. This is therefore NOT atomic, and must not be described as such.
//      Bulk publish and bulk delete are both idempotent per item, so the
//      recovery for a partial application is to fix the failures and run
//      it again.

import { AdminValidationError } from '../../../_api/adminMutations'

/** Upper bound on one batch. Large enough for a full page of a table,
 * small enough that the sequential loop cannot hold a request open long
 * enough to hit a gateway timeout. */
export const MAX_BULK_ITEMS = 100

const OBJECT_ID = /^[0-9a-f]{24}$/i

export interface BulkItemResult {
  id: string
  ok: boolean
  /** Present only on failure. Always an operator-facing message — never an
   * exception's own text, which may carry internals. */
  error?: string
}

export interface BulkResponseBody {
  results: BulkItemResult[]
  succeeded: number
  failed: number
}

export interface ParsedBulkRequest<TAction extends string> {
  action: TAction
  ids: string[]
}

/**
 * Validates the `{ action, ids }` envelope every bulk endpoint accepts.
 *
 * Throws `AdminValidationError` (a 400) rather than returning a result
 * object, so a caller cannot forget to check it — the route's existing
 * `adminErrorResponse` catch turns it into the right response.
 */
export const parseBulkRequest = <TAction extends string>(
  body: Record<string, unknown>,
  allowedActions: readonly TAction[],
): ParsedBulkRequest<TAction> => {
  const action = body.action

  if (typeof action !== 'string' || !allowedActions.includes(action as TAction)) {
    throw new AdminValidationError(
      `\`action\` must be one of: ${allowedActions.join(', ')}.`,
    )
  }

  const rawIds = body.ids

  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    throw new AdminValidationError('`ids` must be a non-empty array.')
  }

  if (rawIds.length > MAX_BULK_ITEMS) {
    throw new AdminValidationError(
      `A bulk action can affect at most ${MAX_BULK_ITEMS} records at a time.`,
    )
  }

  // De-duplicated: the same id twice would otherwise be reported twice, and
  // for a delete the second attempt would report a spurious failure.
  const ids = Array.from(
    new Set(
      rawIds.map(id => {
        if (typeof id !== 'string' || !OBJECT_ID.test(id.trim())) {
          throw new AdminValidationError('`ids` must contain only record ids.')
        }
        return id.trim()
      }),
    ),
  )

  return { action: action as TAction, ids }
}

/**
 * Applies `apply` to each id in turn and collects the outcomes.
 *
 * A thrown `AdminValidationError` is reported as that item's message —
 * "This category still has products in it" is exactly what the operator
 * needs to see. Anything else is logged server-side and reported
 * generically, so an internal failure never leaks its details into an HTTP
 * response.
 */
export const runBulk = async (
  ids: string[],
  apply: (id: string) => Promise<void>,
): Promise<BulkResponseBody> => {
  const results: BulkItemResult[] = []

  for (const id of ids) {
    try {
      await apply(id)
      results.push({ id, ok: true })
    } catch (error: unknown) {
      if (error instanceof AdminValidationError) {
        results.push({ id, ok: false, error: error.message })
      } else {
        // eslint-disable-next-line no-console
        console.error(`bulk action failed for ${id}:`, error)
        results.push({ id, ok: false, error: 'This record could not be updated.' })
      }
    }
  }

  return {
    results,
    succeeded: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length,
  }
}
