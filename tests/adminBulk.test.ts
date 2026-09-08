// tests/adminBulk.test.ts
//
// The bulk-action envelope and runner.
//
// The runner's contract is the interesting part: one failure must not
// abort the batch, and a failure must be attributable to the id that
// caused it. A bulk delete that stops halfway with no report is how an
// operator ends up not knowing what they just did.

import { describe, expect, it, vi } from 'vitest'

import { AdminValidationError } from '../src/app/_api/adminMutations'
import { MAX_BULK_ITEMS, parseBulkRequest, runBulk } from '../src/app/api/admin/_shared/bulk'

const ID_A = '0123456789abcdef01234567'
const ID_B = '0123456789abcdef01234568'
const ACTIONS = ['publish', 'unpublish', 'delete'] as const

describe('parseBulkRequest', () => {
  it('accepts a valid envelope', () => {
    expect(parseBulkRequest({ action: 'publish', ids: [ID_A, ID_B] }, ACTIONS)).toEqual({
      action: 'publish',
      ids: [ID_A, ID_B],
    })
  })

  it('rejects an unknown action rather than treating it as a no-op', () => {
    expect(() => parseBulkRequest({ action: 'destroy', ids: [ID_A] }, ACTIONS)).toThrow(
      AdminValidationError,
    )
  })

  it('rejects a missing action', () => {
    expect(() => parseBulkRequest({ ids: [ID_A] }, ACTIONS)).toThrow(AdminValidationError)
  })

  it('rejects an empty selection', () => {
    expect(() => parseBulkRequest({ action: 'delete', ids: [] }, ACTIONS)).toThrow(
      AdminValidationError,
    )
  })

  it('rejects ids that are not record ids', () => {
    expect(() => parseBulkRequest({ action: 'delete', ids: ['../../etc'] }, ACTIONS)).toThrow(
      AdminValidationError,
    )
  })

  it('caps the batch size', () => {
    const ids = Array.from({ length: MAX_BULK_ITEMS + 1 }, () => ID_A)
    expect(() => parseBulkRequest({ action: 'delete', ids }, ACTIONS)).toThrow(AdminValidationError)
  })

  it('de-duplicates, so the same record is never acted on twice', () => {
    expect(parseBulkRequest({ action: 'delete', ids: [ID_A, ID_A, ID_B] }, ACTIONS).ids).toEqual([
      ID_A,
      ID_B,
    ])
  })
})

describe('runBulk', () => {
  it('reports every item as succeeded when nothing throws', async () => {
    const apply = vi.fn().mockResolvedValue(undefined)

    const report = await runBulk([ID_A, ID_B], apply)

    expect(apply).toHaveBeenCalledTimes(2)
    expect(report.succeeded).toBe(2)
    expect(report.failed).toBe(0)
    expect(report.results).toEqual([
      { id: ID_A, ok: true },
      { id: ID_B, ok: true },
    ])
  })

  it('carries on past a failure and attributes it to the right id', async () => {
    const apply = vi.fn(async (id: string) => {
      if (id === ID_A) throw new AdminValidationError('This category still has products in it.')
    })

    const report = await runBulk([ID_A, ID_B], apply)

    expect(report.succeeded).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.results[0]).toEqual({
      id: ID_A,
      ok: false,
      error: 'This category still has products in it.',
    })
    expect(report.results[1]).toEqual({ id: ID_B, ok: true })
  })

  it('does not leak an unexpected error message to the client', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const report = await runBulk([ID_A], async () => {
      throw new Error('connect ECONNREFUSED 10.0.0.4:27017')
    })

    expect(report.results[0].error).toBe('This record could not be updated.')
    expect(report.results[0].error).not.toContain('ECONNREFUSED')
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('applies items in order, one at a time', async () => {
    const order: string[] = []
    let inFlight = 0
    let maxInFlight = 0

    await runBulk([ID_A, ID_B], async id => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await Promise.resolve()
      order.push(id)
      inFlight -= 1
    })

    expect(order).toEqual([ID_A, ID_B])
    expect(maxInFlight).toBe(1)
  })
})
