// tests/fakes/FakePageRepository.ts
import type {
  PageRepository,
  PageWriteInput,
} from '../../src/lib/repositories/PageRepository'
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

  async create(input: PageWriteInput): Promise<Page> {
    const page: Page = {
      id: Math.random().toString(36).slice(2),
      title: input.title,
      slug: input.slug,
      status: input.status ?? 'draft',
      layout: input.layout ?? [],
      hero: input.hero ?? { type: 'none' },
      meta: {
        title: input.meta?.title,
        description: input.meta?.description,
        imageId: input.meta?.imageId ?? null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.pages.set(page.id, page)
    return page
  }

  async update(id: string, patch: Partial<PageWriteInput>): Promise<Page | null> {
    const page = this.pages.get(id)
    if (!page) return null

    const updated: Page = {
      ...page,
      title: patch.title ?? page.title,
      slug: patch.slug ?? page.slug,
      status: patch.status ?? page.status,
      layout: patch.layout ?? page.layout,
      hero: patch.hero ?? page.hero,
      meta: patch.meta
        ? {
            title: patch.meta.title,
            description: patch.meta.description,
            imageId: patch.meta.imageId ?? null,
          }
        : page.meta,
      updatedAt: new Date(),
    }
    this.pages.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.pages.delete(id)
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
