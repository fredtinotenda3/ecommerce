// src/lib/services/pricing.ts
//
// Pure functions only — no repository/DB access, no I/O. This is what
// lets OrderService's core pricing logic be unit tested without a
// database (see tests/pricing.test.ts).
//
// The central rule enforced here: an OrderItem's price NEVER comes from
// anything the caller supplies. It comes exclusively from the resolved
// `Product` passed in (which the service layer is responsible for having
// fetched fresh from ProductRepository). This is the direct fix for the
// audit's "client-submitted total/price" finding.

import { addMoney, multiplyMoney, sumMoney, zeroMoney } from '../domain/money'
import type { CartItem, CurrencyCode, Money, Order, OrderItem, Product } from '../domain/types'

export class ProductNotPurchasableError extends Error {
  readonly productId: string
  readonly reason: string

  constructor(productId: string, reason: string) {
    super(`Product ${productId} is not purchasable: ${reason}`)
    this.productId = productId
    this.reason = reason
    this.name = 'ProductNotPurchasableError'
  }
}

export class EmptyCartError extends Error {
  constructor() {
    super('Cannot create an order from an empty cart')
    this.name = 'EmptyCartError'
  }
}

export class MixedCurrencyCartError extends Error {
  constructor() {
    super('Cart contains products priced in more than one currency')
    this.name = 'MixedCurrencyCartError'
  }
}

/** Resolves cart line items against a map of freshly-fetched, authoritative
 * Product records. Throws if a requested product is unpurchasable
 * (unpublished, price not set, or quantity <= 0) rather than silently
 * dropping it — callers that want "drop unavailable items and continue"
 * behavior (e.g. CartService) should catch per-item and decide, this
 * function itself is strict by design since OrderService's checkout path
 * must fail loudly on unpurchasable items rather than charge for a
 * different set of items than the customer saw. */
export const resolveOrderItems = (
  cartItems: CartItem[],
  productsById: Map<string, Product>,
): OrderItem[] => {
  if (cartItems.length === 0) {
    throw new EmptyCartError()
  }

  return cartItems.map(item => {
    const product = productsById.get(item.productId)

    if (!product) {
      throw new ProductNotPurchasableError(item.productId, 'product not found')
    }
    if (product.status !== 'published') {
      throw new ProductNotPurchasableError(item.productId, 'product is not published')
    }
    if (product.price === null || product.currency === null) {
      throw new ProductNotPurchasableError(item.productId, 'product has no authoritative price set')
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new ProductNotPurchasableError(item.productId, `invalid quantity: ${item.quantity}`)
    }

    return {
      productId: product.id,
      title: product.title,
      // Authoritative price, read from the resolved Product — NEVER from
      // the incoming cart item, which may carry a stale or tampered value.
      unitPrice: product.price,
      currency: product.currency,
      quantity: item.quantity,
    }
  })
}

export const computeSubtotal = (items: OrderItem[], currency: CurrencyCode): Money => {
  const currencies = new Set(items.map(i => i.currency))
  if (currencies.size > 1) {
    throw new MixedCurrencyCartError()
  }
  const lineTotals = items.map(item => {
    return multiplyMoney({ amount: item.unitPrice, currency: item.currency }, item.quantity)
  })
  return sumMoney(lineTotals, currency)
}

/** Total = subtotal for this phase (no tax/shipping/discount logic yet).
 * Kept as a distinct function so those concerns have an obvious place to
 * be added later without callers needing to change. */
export const computeTotal = (subtotal: Money): Money =>
  addMoney(subtotal, zeroMoney(subtotal.currency))

/** Human-and-machine-friendly order number. Also doubles as the default
 * merchant reference handed to a payment provider (see PaymentService).
 * Format: ORD-<yymmdd>-<8 uppercase hex chars>. Not cryptographically
 * secure by itself — uniqueness is enforced at the database layer via
 * the sparse-unique index on Order.orderNumber (see db/models/Order.ts),
 * this function only needs to make collisions rare, not impossible. */
export const generateOrderNumber = (now: Date = new Date()): string => {
  const yy = String(now.getUTCFullYear()).slice(2)
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const random = Array.from(
    { length: 8 },
    () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)],
  ).join('')
  return `ORD-${yy}${mm}${dd}-${random}`
}

/** Merchant reference sent to the payment provider. Kept as a distinct
 * function from generateOrderNumber (even though it currently just
 * reuses the order number) so a future requirement like "one order, N
 * retry attempts, each needs its own provider-facing reference" has an
 * obvious seam. */
export const generateMerchantReference = (orderNumber: string, attempt = 1): string =>
  attempt <= 1 ? orderNumber : `${orderNumber}-R${attempt}`

export const productsToMap = (products: Product[]): Map<string, Product> =>
  new Map(products.map(p => [p.id, p]))

export type { Order }
