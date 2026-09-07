// src/app/_api/fetchPaywall.ts
//
// Paywalled product content, reached through `POST /api/paywall`.
//
// Authorization rule (kept as its own pure function so it can be tested
// independently of any repository or database concern):
//   - no user            -> never authorized
//   - admin              -> always authorized
//   - anyone else        -> authorized only if the product id is in their
//                           `purchases`
//
// Reads only.

import { resolveStorefrontLayout } from '../../lib/repositories/adapters/layoutRelationsAdapter'
import type { Role } from '../../lib/domain/types'
import type { MediaRepository } from '../../lib/repositories/MediaRepository'
import type { PageRepository } from '../../lib/repositories/PageRepository'
import type { ProductRepository } from '../../lib/repositories/ProductRepository'
import { getRepositories } from './repositories'

export interface PaywallDeps {
  productRepository: ProductRepository
  mediaRepository: MediaRepository
  pageRepository: PageRepository
}

/** Only what the access decision needs — deliberately not a full user. */
export interface PaywallRequestingUser {
  id: string
  roles: Role[]
  purchases: string[]
}

export const canReadPaywall = (user: PaywallRequestingUser | null, productId: string): boolean => {
  if (!user) return false
  if (user.roles.includes('admin')) return true
  return user.purchases.includes(productId)
}

/** Returns the resolved paywall blocks when `user` is authorized, and
 * `null` otherwise — including "product not found", "not authorized" and
 * "anonymous". Callers must not distinguish between those cases in the
 * response: doing so would leak which products exist and which a customer
 * has bought. Published products only. */
export const resolvePaywallBlocks = async (
  slug: string,
  user: PaywallRequestingUser | null,
  deps: PaywallDeps,
): Promise<unknown[] | null> => {
  const product = await deps.productRepository.getBySlug(slug, 'published')
  if (!product) return null

  if (!canReadPaywall(user, product.id)) return null

  return resolveStorefrontLayout(product.paywall, deps)
}

export const fetchPaywall = async (
  slug: string,
  user: PaywallRequestingUser | null,
): Promise<unknown[] | null> => {
  const { products, media, pages } = await getRepositories()

  return resolvePaywallBlocks(slug, user, {
    productRepository: products,
    mediaRepository: media,
    pageRepository: pages,
  })
}
