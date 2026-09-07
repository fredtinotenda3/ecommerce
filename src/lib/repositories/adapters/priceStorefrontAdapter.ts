// src/lib/repositories/adapters/priceStorefrontAdapter.ts
//
// Maps a native `Product`'s authoritative price onto the storefront's
// price view model.
//
// Returns `null` when the product has no price set. A missing price means
// "not purchasable" and must never fall back to a legacy or client-supplied
// value — the same rule `resolveOrderItems` enforces server-side
// (src/lib/services/pricing.ts). Rendering nothing is the correct outcome
// for a product that cannot be sold.
//
// Pure function, no I/O.

import type { StorefrontPrice } from '../../../app/_types/storefront'
import type { Product as NativeProduct } from '../../domain/types'

export const toStorefrontPrice = (
  product: Pick<NativeProduct, 'price' | 'currency'>,
): StorefrontPrice | null => {
  if (product.price === null || product.currency === null) return null
  return { amount: product.price, currency: product.currency }
}
