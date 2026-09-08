// tests/fakes/FakeProductRepository.ts
import type {
  ProductRepository,
  ProductWritePatch,
} from '../../src/lib/repositories/ProductRepository'
import type { Product, ProductListFilter } from '../../src/lib/domain/types'

export class FakeProductRepository implements ProductRepository {
  private products = new Map<string, Product>()

  seed(product: Product): void {
    this.products.set(product.id, product)
  }

  async getById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null
  }

  async getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Product | null> {
    return (
      Array.from(this.products.values()).find(
        p => p.slug === slug && (!status || p.status === status),
      ) ?? null
    )
  }

  private matching(filter: ProductListFilter): Product[] {
    let results = Array.from(this.products.values())
    if (filter.status) results = results.filter(p => p.status === filter.status)
    if (filter.categoryIds?.length) {
      results = results.filter(p => p.categories.some(c => filter.categoryIds!.includes(c)))
    } else if (filter.categoryId) {
      results = results.filter(p => p.categories.includes(filter.categoryId!))
    }
    if (filter.ids) results = results.filter(p => filter.ids!.includes(p.id))
    if (filter.search) {
      const term = filter.search.toLowerCase()
      results = results.filter(
        p =>
          (p.title || '').toLowerCase().includes(term) ||
          (p.meta?.description || '').toLowerCase().includes(term),
      )
    }
    return results
  }

  async list(filter: ProductListFilter = {}): Promise<Product[]> {
    const results = this.matching(filter)

    if (filter.limit != null) {
      const page = filter.page ?? 1
      return results.slice((page - 1) * filter.limit, (page - 1) * filter.limit + filter.limit)
    }

    return results
  }

  async count(filter: ProductListFilter = {}): Promise<number> {
    return this.matching(filter).length
  }

  async create(input: ProductWritePatch & { title: string; slug: string }): Promise<Product> {
    const product: Product = {
      id: Math.random().toString(36).slice(2),
      title: input.title,
      slug: input.slug,
      status: input.status ?? 'draft',
      price: null,
      currency: null,
      compareAtPrice: null,
      categories: input.categoryIds ?? [],
      relatedProducts: input.relatedProductIds ?? [],
      enablePaywall: input.enablePaywall ?? false,
      legacyStripeProductId: null,
      legacyPriceJSON: null,
      layout: input.layout ?? [],
      paywall: input.paywall ?? [],
      meta: {
        title: input.meta?.title,
        description: input.meta?.description,
        imageId: input.meta?.imageId ?? null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.products.set(product.id, product)
    return product
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

  async update(id: string, patch: ProductWritePatch): Promise<Product | null> {
    const product = this.products.get(id)
    if (!product) return null

    const updated: Product = {
      ...product,
      title: patch.title ?? product.title,
      slug: patch.slug ?? product.slug,
      status: patch.status ?? product.status,
      enablePaywall: patch.enablePaywall ?? product.enablePaywall,
      categories: patch.categoryIds ?? product.categories,
      relatedProducts: patch.relatedProductIds ?? product.relatedProducts,
      layout: patch.layout ?? product.layout,
      paywall: patch.paywall ?? product.paywall,
      meta: patch.meta
        ? {
            title: patch.meta.title,
            description: patch.meta.description,
            imageId: patch.meta.imageId ?? null,
          }
        : product.meta,
      updatedAt: new Date(),
    }
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
  layout: [],
  paywall: [],
  meta: { title: undefined, description: undefined, imageId: null },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
