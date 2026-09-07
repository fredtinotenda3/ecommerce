// tests/fakes/FakeMediaRepository.ts
import type {
  MediaCreateInput,
  MediaRepository,
} from '../../src/lib/repositories/MediaRepository'
import type { Media } from '../../src/lib/domain/types'

export class FakeMediaRepository implements MediaRepository {
  private media = new Map<string, Media>()

  seed(media: Media): void {
    this.media.set(media.id, media)
  }

  async getById(id: string): Promise<Media | null> {
    return this.media.get(id) ?? null
  }

  async getByFilename(filename: string): Promise<Media | null> {
    return Array.from(this.media.values()).find(m => m.filename === filename) ?? null
  }

  async list(limit = 50): Promise<Media[]> {
    return Array.from(this.media.values()).slice(0, limit)
  }

  async count(): Promise<number> {
    return this.media.size
  }

  async create(input: MediaCreateInput): Promise<Media> {
    const media: Media = {
      id: Math.random().toString(36).slice(2),
      alt: input.alt,
      url: input.url,
      filename: input.filename,
      mimeType: input.mimeType,
      filesize: input.filesize,
      width: input.width ?? null,
      height: input.height ?? null,
      caption: input.caption ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.media.set(media.id, media)
    return media
  }

  async update(
    id: string,
    patch: Partial<{ alt: string; caption: unknown }>,
  ): Promise<Media | null> {
    const media = this.media.get(id)
    if (!media) return null
    const updated: Media = {
      ...media,
      alt: patch.alt ?? media.alt,
      caption: 'caption' in patch ? patch.caption ?? null : media.caption,
      updatedAt: new Date(),
    }
    this.media.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.media.delete(id)
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
