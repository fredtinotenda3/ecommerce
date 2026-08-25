// tests/fakes/FakePageRepository.ts
import type { PageRepository } from '../../src/lib/repositories/PageRepository'
import type { Page } from '../../src/lib/domain/types'

export class FakePageRepository implements PageRepository {
  private pages = new Map<string, Page>()

  seed(page: Page): void {
    this.pages.set(page.id, page)
  }

  async getById(id: string): Promise<Page | null> {
    return this.pages.get(id) ?? null
  }

  async getBySlug(slug: string, status?: 'draft' | 'published'): Promise<Page | null> {
    return (
      Array.from(this.pages.values()).find(
        page => page.slug === slug && (!status || page.status === status),
      ) ?? null
    )
  }

  async list(status?: 'draft' | 'published'): Promise<Page[]> {
    let results = Array.from(this.pages.values())
    if (status) results = results.filter(page => page.status === status)
    return results
  }
}

export const buildTestPage = (overrides: Partial<Page> = {}): Page => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  title: 'Test Page',
  slug: 'test-page',
  status: 'published',
  layout: [],
  hero: { type: 'none' },
  meta: { title: undefined, description: undefined, imageId: null },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
