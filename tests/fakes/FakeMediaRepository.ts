// tests/fakes/FakeMediaRepository.ts
import type { MediaRepository } from '../../src/lib/repositories/MediaRepository'
import type { Media } from '../../src/lib/domain/types'

export class FakeMediaRepository implements MediaRepository {
  private media = new Map<string, Media>()

  seed(media: Media): void {
    this.media.set(media.id, media)
  }

  async getById(id: string): Promise<Media | null> {
    return this.media.get(id) ?? null
  }

  async list(limit = 50): Promise<Media[]> {
    return Array.from(this.media.values()).slice(0, limit)
  }
}

export const buildTestMedia = (overrides: Partial<Media> = {}): Media => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  alt: 'Test media',
  url: 'https://example.com/test.jpg',
  filename: 'test.jpg',
  mimeType: 'image/jpeg',
  filesize: 1024,
  width: 800,
  height: 600,
  caption: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})
