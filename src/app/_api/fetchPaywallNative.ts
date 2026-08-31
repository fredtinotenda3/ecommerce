// src/app/_api/fetchPaywallNative.ts
//
// PHASE 13A — native equivalent of `PaywallBlocks`' direct
// `PRODUCT_PAYWALL` GraphQL query (see src/app/_graphql/products.ts).
// Reached via `/api/paywall` (src/app/api/paywall/route.ts) only when
// `USE_NATIVE_REPOSITORY=true`; the GraphQL proxy path remains the
// default. Mirrors the `buildStorefrontProduct` / `fetchProductNative`
// split in fetchProductNative.ts: `resolvePaywallBlocks` takes
// repository INTERFACES (unit-testable with fakes — see
// tests/fetchPaywallNative.test.ts), and `fetchPaywallNative` supplies
// the concrete Mongo-backed repositories for the real route handler.
//
// Reproduces Payload's own field-level access control for the `paywall`
// field (src/payload/collections/Products/access/checkUserPurchases.ts):
//   - no user → never authorized
//   - admin → always authorized
//   - otherwise → authorized only if the product's id is in the user's
//     `purchases`
// `canReadPaywall` is exported separately so that rule can be tested in
// isolation from any repository/DB concern.
//
// READS ONLY.

import { getDbConnection } from '../../lib/db/connection'
import type { Role } from '../../lib/domain/types'
import { resolveStorefrontLayout } from '../../lib/repositories/adapters/layoutRelationsAdapter'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import { MongoMediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import { MongoPageRepository } from '../../lib/repositories/PageRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'

export interface PaywallNativeDeps {
  productRepository: ProductRepository
  mediaRepository: MediaRepository
  pageRepository: PageRepository
}

/** Only what's needed to evaluate paywall access — deliberately not the
 * full `AuthenticatedPayloadUser`/domain `User` shape, same "narrow
 * contract" rationale as `getAuthenticatedPayloadUser.ts`. */
export interface PaywallRequestingUser {
  id: string
  roles: Role[]
  purchases: string[]
}

/** Pure authorization rule — see this file's header comment for the
 * Payload access-control logic it mirrors. */
export const canReadPaywall = (user: PaywallRequestingUser | null, productId: string): boolean => {
  if (!user) return false
  if (user.roles.includes('admin')) return true
  return user.purchases.includes(productId)
}

/** Returns the resolved paywall blocks if `user` is authorized to see
 * them, or `null` otherwise — including "product not found",
 * "not authorized", and "anonymous" — matching the falsy `paywall`
 * value the existing GraphQL query already returns to an
 * unauthorized/anonymous caller (Payload omits the field rather than
 * erroring). Only published products are considered, matching the
 * existing `PRODUCT_PAYWALL` query's unfiltered-by-draft default. */
export const resolvePaywallBlocks = async (
  slug: string,
  user: PaywallRequestingUser | null,
  deps: PaywallNativeDeps,
): Promise<unknown[] | null> => {
  const product = await deps.productRepository.getBySlug(slug, 'published')
  if (!product) return null

  if (!canReadPaywall(user, product.id)) return null

  return resolveStorefrontLayout(product.paywall, deps)
}

/** Native equivalent of the `PRODUCT_PAYWALL` GraphQL query, DB-wired. */
export const fetchPaywallNative = async (
  slug: string,
  user: PaywallRequestingUser | null,
): Promise<unknown[] | null> => {
  const connection = await getDbConnection()

  return resolvePaywallBlocks(slug, user, {
    productRepository: new MongoProductRepository(connection),
    mediaRepository: new MongoMediaRepository(connection),
    pageRepository: new MongoPageRepository(connection),
  })
}
