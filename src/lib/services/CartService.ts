// src/lib/services/CartService.ts
import type { CartItem, Money, OrderItem, Product } from '../domain/types'
import type { ProductRepository } from '../repositories/ProductRepository'
import { computeSubtotal, productsToMap } from './pricing'

export interface CartValidationResult {
  /** Items that are currently purchasable, priced from the database. */
  validItems: OrderItem[]
  /** Product ids that were in the cart but are no longer purchasable
   * (deleted, unpublished, or missing a price) — the caller (typically a
   * cart API route) is responsible for deciding how to surface this to
   * the customer (e.g. "these items were removed from your cart"). */
  unavailableProductIds: string[]
  /** `null` when validItems is empty (nothing to sum) or when the valid
   * items span more than one currency, which the store does not
   * currently support — in that case ALL items end up in
   * unavailableProductIds rather than silently summing across
   * currencies. */
  subtotal: Money | null
}

export class CartService {
  constructor(private readonly productRepository: ProductRepository) {}

  /** This is the single place cart totals are computed server-side. The
   * client-computed cart total (see the audit's Cart Audit) remains fine
   * for display purposes, but nothing downstream — checkout in
   * particular — should ever trust it. Always call this immediately
   * before initiating checkout. */
  async validateCart(cartItems: CartItem[]): Promise<CartValidationResult> {
    if (cartItems.length === 0) {
      return { validItems: [], unavailableProductIds: [], subtotal: null }
    }

    const products = await Promise.all(
      cartItems.map(item => this.productRepository.getById(item.productId)),
    )

    const productsById = productsToMap(products.filter((p): p is Product => p !== null))

    const validItems: OrderItem[] = []
    const unavailableProductIds: string[] = []

    for (const item of cartItems) {
      const product = productsById.get(item.productId)
      const isPurchasable =
        product !== undefined &&
        product.status === 'published' &&
        product.price !== null &&
        product.currency !== null &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0

      if (!isPurchasable || !product || product.price === null || product.currency === null) {
        unavailableProductIds.push(item.productId)
        continue
      }

      validItems.push({
        productId: product.id,
        title: product.title,
        unitPrice: product.price,
        currency: product.currency,
        quantity: item.quantity,
      })
    }

    if (validItems.length === 0) {
      return { validItems: [], unavailableProductIds, subtotal: null }
    }

    const currencies = new Set(validItems.map(i => i.currency))
    if (currencies.size > 1) {
      // Store does not currently support mixed-currency carts. Fail safe:
      // report everything as unavailable rather than guessing which
      // currency should "win".
      return {
        validItems: [],
        unavailableProductIds: cartItems.map(i => i.productId),
        subtotal: null,
      }
    }

    const subtotal = computeSubtotal(validItems, validItems[0].currency)

    return { validItems, unavailableProductIds, subtotal }
  }
}
