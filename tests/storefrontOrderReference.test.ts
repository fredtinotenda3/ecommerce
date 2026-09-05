// tests/storefrontOrderReference.test.ts
//
// PHASE 13M — type-level test for the `StorefrontOrderReference` view
// model added to src/app/_types/storefront.ts (used by
// `CheckoutForm`, which only ever reads `.id` off the `Order` returned
// from Payload's `/api/orders` REST endpoint). Same rationale as
// tests/storefrontCmsBlocks.test.ts (Phase 13L): this type has no
// runtime behavior of its own, so the main thing worth locking in is
// that a real `payload-types.ts` `Order` object still satisfies the
// narrowed type unchanged. The literal below only type-checks if that
// stays true, so a future edit that breaks the relationship fails
// `npm run test`'s `tsc`-backed collection step the same as
// `npx tsc --noEmit` would.

import { describe, expect, it } from 'vitest'

import type { StorefrontOrderReference } from '../src/app/_types/storefront'
import type { Order as PayloadOrder } from '../src/payload/payload-types'

describe('StorefrontOrderReference (Phase 13M)', () => {
  it('accepts a minimal object with only an id', () => {
    const ref: StorefrontOrderReference = { id: 'order-123' }
    expect(ref.id).toBe('order-123')
  })

  it('accepts a real payload-types.ts Order object unchanged (extra fields ignored)', () => {
    const payloadOrder: PayloadOrder = {
      id: 'order-456',
      orderedBy: 'user-1',
      stripePaymentIntentID: 'pi_123',
      total: 1999,
      items: [],
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    const ref: StorefrontOrderReference = payloadOrder
    expect(ref.id).toBe('order-456')
  })
})
