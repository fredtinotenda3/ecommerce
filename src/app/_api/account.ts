// src/app/_api/account.ts
//
// Writes a customer may make to their own record: the cart, their profile
// (name/email), and their password.
//
// Every function here takes the authenticated customer's id from the
// session — never from the request body — so a caller cannot address
// another customer's record. Roles and purchases are deliberately not
// writable here: granting yourself `admin`, or a product you did not buy,
// must not be reachable from a customer-facing endpoint.

import { hashPasswordPayloadCompatible, MIN_NATIVE_PASSWORD_LENGTH } from '../../lib/auth/password'
import { toStorefrontUser } from '../../lib/repositories/adapters/userStorefrontAdapter'
import type { CartItem } from '../../lib/domain/types'
import type { StorefrontUser } from '../_types/storefront'
import { getRepositories } from './repositories'

export class AccountUpdateError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AccountUpdateError'
    this.status = status
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Replaces the customer's cart with `items`, after dropping anything that
 * does not resolve to a published product. Quantities are coerced to
 * positive integers. Nothing here is ever used for pricing — checkout
 * re-reads the cart and re-derives every price server-side. */
export const updateCart = async (
  customerId: string,
  items: { product?: unknown; quantity?: unknown }[],
): Promise<StorefrontUser> => {
  const { users, products } = await getRepositories()

  const resolved: CartItem[] = []

  for (const item of items) {
    const productId = typeof item.product === 'string' ? item.product : null
    if (!productId) continue

    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity)
        ? Math.max(1, Math.floor(item.quantity))
        : 1

    let product
    try {
      product = await products.getById(productId)
    } catch {
      // An id that is not a valid ObjectId is simply not a cart line.
      continue
    }
    if (!product || product.status !== 'published') continue

    resolved.push({ productId: product.id, quantity })
  }

  const updated = await users.updateCart(customerId, resolved)
  if (!updated) throw new AccountUpdateError('Account not found.', 404)

  return toStorefrontUser(updated)
}

export interface ProfileUpdate {
  name?: unknown
  email?: unknown
  password?: unknown
}

/** Updates name, email and/or password. An email already registered to
 * another account is rejected; the check is a lookup rather than a reliance
 * on the unique index so the caller gets a 409 instead of a 500. */
export const updateProfile = async (
  customerId: string,
  update: ProfileUpdate,
): Promise<StorefrontUser> => {
  const { users, authUsers } = await getRepositories()

  const patch: { name?: string | null; email?: string } = {}

  if (typeof update.name === 'string') {
    patch.name = update.name.trim() || null
  }

  if (typeof update.email === 'string' && update.email.trim().length > 0) {
    const email = update.email.trim().toLowerCase()
    if (!EMAIL_PATTERN.test(email)) {
      throw new AccountUpdateError('Enter a valid email address.')
    }
    const existing = await users.getByEmail(email)
    if (existing && existing.id !== customerId) {
      throw new AccountUpdateError('That email address is already in use.', 409)
    }
    patch.email = email
  }

  if (typeof update.password === 'string' && update.password.length > 0) {
    if (update.password.length < MIN_NATIVE_PASSWORD_LENGTH) {
      throw new AccountUpdateError(
        `Password must be at least ${MIN_NATIVE_PASSWORD_LENGTH} characters.`,
      )
    }
    const { hash, salt } = await hashPasswordPayloadCompatible(update.password)
    await authUsers.updatePasswordHash(customerId, hash, salt)
  }

  const updated =
    Object.keys(patch).length > 0
      ? await users.updateProfile(customerId, patch)
      : await users.getById(customerId)

  if (!updated) throw new AccountUpdateError('Account not found.', 404)

  return toStorefrontUser(updated)
}
