// src/lib/repositories/adapters/userStorefrontAdapter.ts
//
// Maps a native domain `User` onto the storefront's user view model — what
// `getMeUser`/`AuthProvider` and the account pages read.
//
// `purchases` is returned as bare product ids rather than populated
// documents; every consumer already handles the id case (see
// account/purchases/page.tsx). Nothing here ever carries a password hash,
// salt or reset token: those live only on `AuthUserRecord` and must not
// cross into the storefront.
//
// Pure function, no I/O.

import type { StorefrontUser } from '../../../app/_types/storefront'
import type { User as NativeUser } from '../../domain/types'

export const toStorefrontUser = (user: NativeUser): StorefrontUser => ({
  id: user.id,
  name: user.name ?? null,
  email: user.email,
  roles: user.roles,
  purchases: user.purchases,
  cart: {
    items: user.cart.map(item => ({
      product: item.productId,
      quantity: item.quantity,
    })),
  },
  updatedAt: user.updatedAt.toISOString(),
  createdAt: user.createdAt.toISOString(),
})
