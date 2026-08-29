// tests/migrations/legacyStripeIdBackfill.test.ts
import { describe, expect, it } from 'vitest'
import { computeLegacyFieldDecision } from '../../scripts/migrations/lib/legacyStripeIdBackfill'

describe('computeLegacyFieldDecision', () => {
  it('migrates when the legacy source value is present and the target is empty', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: 'prod_stripe_1', currentTargetValue: null },
      false,
    )
    expect(decision.action).toBe('migrate')
    expect(decision.targetValue).toBe('prod_stripe_1')
  })

  it('skips when there is no legacy source value to preserve', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: null, currentTargetValue: null },
      false,
    )
    expect(decision.action).toBe('skip')
    expect(decision.reason).toMatch(/no legacy source value/)
  })

  it('skips (does not overwrite) when the target is already populated and force is false', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: 'prod_stripe_1', currentTargetValue: 'prod_already_set' },
      false,
    )
    expect(decision.action).toBe('skip')
    expect(decision.reason).toMatch(/already populated/)
  })

  it('overwrites an already-populated target when force is true and the values differ', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: 'prod_stripe_1', currentTargetValue: 'prod_stale' },
      true,
    )
    expect(decision.action).toBe('migrate')
    expect(decision.targetValue).toBe('prod_stripe_1')
  })

  it('is a no-op (skip) when force is true but the target already matches the source', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: 'prod_stripe_1', currentTargetValue: 'prod_stripe_1' },
      true,
    )
    expect(decision.action).toBe('skip')
  })

  it('treats an empty-string legacy source value the same as absent (no data to preserve)', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: '', currentTargetValue: null },
      false,
    )
    expect(decision.action).toBe('skip')
  })

  it('never surfaces a "delete" or destructive action — only migrate/skip are possible outcomes', () => {
    const decision = computeLegacyFieldDecision(
      { id: 'p1', legacySourceValue: 'x', currentTargetValue: undefined },
      false,
    )
    expect(['migrate', 'skip']).toContain(decision.action)
  })
})
