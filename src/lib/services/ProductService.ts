// src/lib/services/ProductService.ts
import type { Money, Product, ProductListFilter } from '../domain/types'
import type { ProductRepository } from '../repositories/ProductRepository'

export class ProductService {
  constructor(private readonly productRepository: ProductRepository) {}

  async getBySlug(slug: string): Promise<Product | null> {
    return this.productRepository.getBySlug(slug)
  }

  async listPublished(filter: Omit<ProductListFilter, 'status'> = {}): Promise<Product[]> {
    return this.productRepository.list({ ...filter, status: 'published' })
  }

  /** The single sanctioned way to read a product's current authoritative
   * price. Returns `null` if the product has no native price set yet
   * (e.g. not yet backfilled — see scripts/migrations/backfillProductPrices.ts)
   * rather than falling back to any legacy/Stripe value. Callers (cart,
   * checkout) must treat `null` as "not currently purchasable". */
  async getAuthoritativePrice(productId: string): Promise<Money | null> {
    const product = await this.productRepository.getById(productId)
    if (!product || product.price === null || product.currency === null) {
      return null
    }
    return { amount: product.price, currency: product.currency }
  }

  async setPrice(
    productId: string,
    price: { amount: number; currency: string; compareAtPrice?: number | null },
  ): Promise<Product | null> {
    if (!Number.isInteger(price.amount) || price.amount < 0) {
      throw new Error(
        `ProductService.setPrice: amount must be a non-negative integer (minor units), got ${price.amount}`,
      )
    }
    return this.productRepository.setPrice(productId, price)
  }
}
