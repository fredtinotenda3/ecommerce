// scripts/migrations/lib/legacyStripeIdBackfill.ts
//
// Shared, pure decision logic for the two "preserve a legacy Stripe id
// under a new field name" migrations (Product.stripeProductID ->
// Product.legacyStripeProductId, User.stripeCustomerID ->
// User.legacyStripeCustomerId). Both migrations are the exact same shape
// of operation — copy one string field to another, additively, unless
// already populated — so the decision logic lives here once and each
// migration script is just I/O (Mongo find/update) around it.
//
// Deliberately has ZERO knowledge of Mongoose/Mongo: this is what makes it
// testable with plain fixtures (see tests/migrations/legacyStripeIdBackfill.test.ts).

export interface LegacyFieldRecord {
  id: string
  /** The existing legacy field's current value (e.g. `stripeProductID`). */
  legacySourceValue: string | null | undefined
  /** The new field's current value (e.g. `legacyStripeProductId`), if any. */
  currentTargetValue: string | null | undefined
}

export type LegacyFieldAction = 'migrate' | 'skip'

export interface LegacyFieldDecision {
  id: string
  action: LegacyFieldAction
  reason?: string
  /** Only present when action === 'migrate'. */
  targetValue?: string
}

/** Decides what (if anything) should be written for a single record.
 * Never mutates or deletes `legacySourceValue` — this function only ever
 * describes a write to the target field. */
export const computeLegacyFieldDecision = (
  record: LegacyFieldRecord,
  force: boolean,
): LegacyFieldDecision => {
  const hasTargetValue =
    typeof record.currentTargetValue === 'string' && record.currentTargetValue.length > 0

  if (hasTargetValue && !force) {
    return {
      id: record.id,
      action: 'skip',
      reason: 'target field already populated (pass --force to overwrite)',
    }
  }

  const hasSourceValue =
    typeof record.legacySourceValue === 'string' && record.legacySourceValue.length > 0

  if (!hasSourceValue) {
    return {
      id: record.id,
      action: 'skip',
      reason: 'no legacy source value to preserve',
    }
  }

  if (hasTargetValue && force && record.currentTargetValue === record.legacySourceValue) {
    return {
      id: record.id,
      action: 'skip',
      reason: 'target field already matches legacy source value',
    }
  }

  return {
    id: record.id,
    action: 'migrate',
    targetValue: record.legacySourceValue as string,
  }
}
