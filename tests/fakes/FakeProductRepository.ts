// tests/fakes/FakeProductRepository.ts
import type { ProductRepository } from '../../src/lib/repositories/ProductRepository'
import type { Product, ProductListFilter } from '../../src/lib/domain/types'

export class FakeProductRepository implements ProductRepository {
  private products = new Map<string, Product>()

  seed(product: Product): void {
    this.products.set(product.id, product)
  }

  async getById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null
  }

  async getBySlug(slug: string): Promise<Product | null> {
    return Array.from(this.products.values()).find(p => p.slug === slug) ?? null
  }

  async list(filter: ProductListFilter = {}): Promise<Product[]> {
    let results = Array.from(this.products.values())
    if (filter.status) results = results.filter(p => p.status === filter.status)
    if (filter.categoryId) results = results.filter(p => p.categories.includes(filter.categoryId!))
    if (filter.ids) results = results.filter(p => filter.ids!.includes(p.id))
    return results
  }

  async setPrice(
    id: string,
    price: { amount: number; currency: string; compareAtPrice?: number | null },
  ): Promise<Product | null> {
    const product = this.products.get(id)
    if (!product) return null
    const updated: Product = {
      ...product,
      price: price.amount,
      currency: price.currency,
      compareAtPrice: price.compareAtPrice ?? null,
    }
    this.products.set(id, updated)
    return updated
  }

  async update(
    id: string,
    patch: Partial<Pick<Product, 'title' | 'slug' | 'enablePaywall'>>,
  ): Promise<Product | null> {
    const product = this.products.get(id)
    if (!product) return null
    const updated = { ...product, ...patch }
    this.products.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.products.delete(id)
  }
}

export const buildTestProduct = (overrides: Partial<Product> = {}): Product => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  title: 'Test Product',
  slug: 'test-product',
  status: 'published',
  price: 1999,
  currency: 'USD',
  compareAtPrice: null,
  categories: [],
  relatedProducts: [],
  enablePaywall: false,
  legacyStripeProductId: null,
  legacyPriceJSON: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
