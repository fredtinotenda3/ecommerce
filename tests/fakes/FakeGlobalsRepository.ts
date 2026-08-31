// tests/fakes/FakeGlobalsRepository.ts
import type { Footer, Header, Settings } from '../../src/lib/domain/types'
import type { GlobalsRepository } from '../../src/lib/repositories/GlobalsRepository'

export class FakeGlobalsRepository implements GlobalsRepository {
  private header: Header | null = null
  private footer: Footer | null = null
  private settings: Settings | null = null

  seedHeader(header: Header): void {
    this.header = header
  }

  seedFooter(footer: Footer): void {
    this.footer = footer
  }

  seedSettings(settings: Settings): void {
    this.settings = settings
  }

  async getHeader(): Promise<Header | null> {
    return this.header
  }

  async getFooter(): Promise<Footer | null> {
    return this.footer
  }

  async getSettings(): Promise<Settings | null> {
    return this.settings
  }
}

export const buildTestHeader = (overrides: Partial<Header> = {}): Header => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  navItems: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const buildTestFooter = (overrides: Partial<Footer> = {}): Footer => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  copyright: '© Test',
  navItems: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const buildTestSettings = (overrides: Partial<Settings> = {}): Settings => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  productsPageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
