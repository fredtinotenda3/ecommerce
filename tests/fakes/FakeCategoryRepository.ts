// tests/fakes/FakeCategoryRepository.ts
import type { CategoryRepository } from '../../src/lib/repositories/CategoryRepository'
import type { Category } from '../../src/lib/domain/types'

export class FakeCategoryRepository implements CategoryRepository {
  private categories = new Map<string, Category>()

  seed(category: Category): void {
    this.categories.set(category.id, category)
  }

  async getById(id: string): Promise<Category | null> {
    return this.categories.get(id) ?? null
  }

  async list(): Promise<Category[]> {
    return Array.from(this.categories.values())
  }

  async create(input: {
    title: string
    mediaId?: string | null
    parentId?: string | null
  }): Promise<Category> {
    const category = buildTestCategory({
      id: Math.random().toString(36).slice(2),
      title: input.title,
      mediaId: input.mediaId ?? null,
      parentId: input.parentId ?? null,
    })
    this.categories.set(category.id, category)
    return category
  }

  async update(
    id: string,
    patch: Partial<{ title: string; mediaId: string | null; parentId: string | null }>,
  ): Promise<Category | null> {
    const category = this.categories.get(id)
    if (!category) return null
    const updated: Category = { ...category, ...patch, updatedAt: new Date() }
    this.categories.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.categories.delete(id)
  }
}

export const buildTestCategory = (overrides: Partial<Category> = {}): Category => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  title: 'Test Category',
  mediaId: null,
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
