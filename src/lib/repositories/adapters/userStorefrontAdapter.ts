// src/lib/repositories/adapters/userStorefrontAdapter.ts
//
// PHASE 13A — maps a native domain `User` (src/lib/domain/types.ts) onto
// the exact shape `getMeUser`/`getMe` already return from Payload's own
// `/api/users/me` REST endpoint / `ME_QUERY` GraphQL query (see
// src/app/_graphql/me.ts), so pages that read `user.*` behave
// identically regardless of which auth system resolved the session.
//
// `purchases` is intentionally returned as bare string ids, not
// populated Product documents. `payload-types.ts`'s `User.purchases` is
// typed `string[] | Product[]`, and every consumer already handles the
// string-id case today (see e.g. account/purchases/page.tsx's
// `typeof purchase === 'string'` branch), so this stays a pure,
// dependency-free mapping with no extra product lookups needed. If a
// future phase wants populated purchases here, that's an intentional
// follow-up, not a gap this adapter silently papers over — see
// docs/PHASE13A_REPORT.md's "Remaining Blockers".
//
// `password` is always returned as an empty string: Payload's own type
// requires the field, but no caller of getMeUser/getMe ever reads it —
// Payload's real GraphQL/REST responses never include the actual hash
// under this field either.
//
// Pure function, no I/O.

import type { User as PayloadUser } from '../../../payload/payload-types'
import type { User as NativeUser } from '../../domain/types'

export const toStorefrontUser = (user: NativeUser): PayloadUser => ({
  id: user.id,
  name: user.name ?? undefined,
  email: user.email,
  roles: user.roles,
  purchases: user.purchases,
  stripeCustomerID: user.legacyStripeCustomerId ?? undefined,
  cart: {
    items: user.cart.map(item => ({
      product: item.productId,
      quantity: item.quantity,
    })),
  },
  updatedAt: user.updatedAt.toISOString(),
  createdAt: user.createdAt.toISOString(),
  password: '',
})
