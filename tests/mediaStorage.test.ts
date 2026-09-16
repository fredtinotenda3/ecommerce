// tests/mediaStorage.test.ts
//
// Upload validation and path handling.
//
// Every case here is one where a mistake is a security hole rather than a
// bug: a filename that escapes the upload directory, a request path that
// reads outside it, or a file whose declared type does not match what it
// actually contains.
//
// Uses a real temporary directory, so the containment checks are exercised
// against actual filesystem behaviour rather than a mock of it.

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ALLOWED_MIME_TYPES,
  buildStoredFilename,
  contentTypeForPath,
  deleteStoredFile,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  maxUploadBytesFor,
  MediaUploadError,
  resolveMediaPath,
  storeUpload,
} from '../src/lib/media/storage'

/** Smallest bytes that satisfy each format's magic-number check. */
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const buildPng = (width: number, height: number): Buffer => {
  const buffer = Buffer.alloc(24)
  PNG_HEADER.copy(buffer, 0)
  buffer.write('IHDR', 12, 'ascii')
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

/** A minimal, valid-enough MP4: a `ftyp` box (size, "ftyp", major brand) —
 * everything `storeUpload`'s magic-number check actually looks at. */
const buildMp4 = (): Buffer => {
  const buffer = Buffer.alloc(16)
  buffer.writeUInt32BE(16, 0)
  buffer.write('ftyp', 4, 'ascii')
  buffer.write('isom', 8, 'ascii')
  return buffer
}

/** A minimal WebM: just the EBML header magic number, padded past the
 * 4-byte length the check requires. */
const buildWebm = (): Buffer => Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00])

let mediaDir: string

beforeAll(() => {
  mediaDir = mkdtempSync(join(tmpdir(), 'media-test-'))
  process.env.MEDIA_DIR = mediaDir
})

afterAll(() => {
  rmSync(mediaDir, { recursive: true, force: true })
  delete process.env.MEDIA_DIR
})

describe('buildStoredFilename', () => {
  it('keeps a readable stem and adds a random suffix', () => {
    const filename = buildStoredFilename('Winter Boots.PNG', 'image/png')

    expect(filename).toMatch(/^winter-boots-[a-f0-9]{12}\.png$/)
  })

  it('never lets a path separator through', () => {
    const filename = buildStoredFilename('../../etc/passwd.png', 'image/png')

    expect(filename).not.toContain('/')
    expect(filename).not.toContain('..')
    expect(filename).toMatch(/^passwd-[a-f0-9]{12}\.png$/)
  })

  it('handles a Windows-style path', () => {
    const filename = buildStoredFilename('C:\\Users\\me\\photo.jpg', 'image/jpeg')

    expect(filename).not.toContain('\\')
    expect(filename).toMatch(/^photo-[a-f0-9]{12}\.jpg$/)
  })

  it('falls back to a default stem when the name has nothing usable', () => {
    const filename = buildStoredFilename('***.png', 'image/png')

    expect(filename).toMatch(/^upload-[a-f0-9]{12}\.png$/)
  })

  it('takes the extension from the verified type, not the supplied name', () => {
    const filename = buildStoredFilename('malicious.php', 'image/png')

    expect(filename.endsWith('.png')).toBe(true)
  })

  it('gives two uploads of the same name different stored names', () => {
    const first = buildStoredFilename('photo.png', 'image/png')
    const second = buildStoredFilename('photo.png', 'image/png')

    expect(first).not.toBe(second)
  })

  it('refuses a type that is not allowed', () => {
    expect(() => buildStoredFilename('doc.pdf', 'application/pdf')).toThrow(MediaUploadError)
  })
})

describe('storeUpload', () => {
  it('writes the file and reports its dimensions', async () => {
    const stored = await storeUpload(buildPng(800, 600), 'photo.png', 'image/png')

    expect(stored.url).toBe(`/media/${stored.filename}`)
    expect(stored.width).toBe(800)
    expect(stored.height).toBe(600)
    expect(stored.mimeType).toBe('image/png')

    const path = await resolveMediaPath(stored.filename)
    expect(path).toBe(resolve(join(mediaDir, stored.filename)))
  })

  it('rejects an empty file', async () => {
    await expect(storeUpload(Buffer.alloc(0), 'empty.png', 'image/png')).rejects.toThrow(
      /empty/,
    )
  })

  it('rejects a file over the size limit', async () => {
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1)
    PNG_HEADER.copy(oversized, 0)

    await expect(storeUpload(oversized, 'big.png', 'image/png')).rejects.toThrow(/or smaller/)
  })

  it('rejects a type that is not on the allow-list', async () => {
    await expect(storeUpload(Buffer.from('%PDF-1.4'), 'doc.pdf', 'application/pdf')).rejects.toThrow(
      /Unsupported file type/,
    )
  })

  it('rejects SVG, which can carry script and is served from this origin', async () => {
    expect(ALLOWED_MIME_TYPES['image/svg+xml']).toBeUndefined()

    await expect(
      storeUpload(Buffer.from('<svg onload="alert(1)"/>'), 'x.svg', 'image/svg+xml'),
    ).rejects.toThrow(/Unsupported file type/)
  })

  it('rejects a file whose contents do not match its declared type', async () => {
    const notAnImage = Buffer.from('<?php system($_GET["c"]); ?>')

    await expect(storeUpload(notAnImage, 'photo.png', 'image/png')).rejects.toThrow(
      /not a valid image\/png image/,
    )
  })

  it('ignores charset parameters on the declared type', async () => {
    const stored = await storeUpload(buildPng(10, 10), 'photo.png', 'image/png; charset=binary')

    expect(stored.mimeType).toBe('image/png')
  })

  it('accepts a valid MP4 upload, with no dimensions (no video parser)', async () => {
    const stored = await storeUpload(buildMp4(), 'clip.mp4', 'video/mp4')

    expect(stored.mimeType).toBe('video/mp4')
    expect(stored.url).toBe(`/media/${stored.filename}`)
    expect(stored.width).toBeNull()
    expect(stored.height).toBeNull()
  })

  it('accepts a valid WebM upload', async () => {
    const stored = await storeUpload(buildWebm(), 'clip.webm', 'video/webm')

    expect(stored.mimeType).toBe('video/webm')
  })

  it('rejects a file claiming to be MP4 whose bytes are not', async () => {
    await expect(
      storeUpload(Buffer.from('not a real video file'), 'fake.mp4', 'video/mp4'),
    ).rejects.toThrow(/not a valid video\/mp4 video/)
  })

  it('allows a video well past the image size limit, up to its own higher ceiling', async () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1024 * 1024)
    buildMp4().copy(big, 0)

    const stored = await storeUpload(big, 'clip.mp4', 'video/mp4')
    expect(stored.mimeType).toBe('video/mp4')
  })

  it('still rejects a video over the video size limit', async () => {
    const tooBig = Buffer.alloc(MAX_VIDEO_UPLOAD_BYTES + 1)
    buildMp4().copy(tooBig, 0)

    await expect(storeUpload(tooBig, 'clip.mp4', 'video/mp4')).rejects.toThrow(/or smaller/)
  })
})

describe('maxUploadBytesFor', () => {
  it('gives video its own, larger ceiling', () => {
    expect(maxUploadBytesFor('video/mp4')).toBe(MAX_VIDEO_UPLOAD_BYTES)
    expect(maxUploadBytesFor('video/webm')).toBe(MAX_VIDEO_UPLOAD_BYTES)
  })

  it('gives every image type the standard ceiling', () => {
    expect(maxUploadBytesFor('image/png')).toBe(MAX_UPLOAD_BYTES)
  })
})

describe('resolveMediaPath', () => {
  it('returns null for a file that does not exist', async () => {
    expect(await resolveMediaPath('nope.png')).toBeNull()
  })

  it('refuses to escape the media directory with ..', async () => {
    const secretsDir = mkdtempSync(join(tmpdir(), 'secrets-'))
    writeFileSync(join(secretsDir, 'secret.txt'), 'password')

    try {
      const relative = `../${secretsDir.split('/').pop()}/secret.txt`
      expect(await resolveMediaPath(relative)).toBeNull()
      expect(await resolveMediaPath('../../etc/passwd')).toBeNull()
    } finally {
      rmSync(secretsDir, { recursive: true, force: true })
    }
  })

  it('refuses a NUL byte in the path', async () => {
    expect(await resolveMediaPath('photo.png\0.txt')).toBeNull()
  })

  it('strips a leading slash rather than treating the path as absolute', async () => {
    const stored = await storeUpload(buildPng(4, 4), 'leading.png', 'image/png')

    expect(await resolveMediaPath(`/${stored.filename}`)).not.toBeNull()
  })

  it('falls back to public/media so files from before the migration still resolve', async () => {
    const legacyDir = join(process.cwd(), 'public', 'media')
    const legacyName = `legacy-fixture-${Date.now()}.png`

    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, legacyName), buildPng(2, 2))

    try {
      expect(await resolveMediaPath(legacyName)).toBe(resolve(join(legacyDir, legacyName)))
    } finally {
      rmSync(join(legacyDir, legacyName), { force: true })
    }
  })
})

describe('deleteStoredFile', () => {
  it('removes a stored file', async () => {
    const stored = await storeUpload(buildPng(5, 5), 'delete-me.png', 'image/png')

    await deleteStoredFile(stored.filename)

    expect(await resolveMediaPath(stored.filename)).toBeNull()
  })

  it('treats a missing file as already deleted', async () => {
    await expect(deleteStoredFile('never-existed.png')).resolves.toBeUndefined()
  })

  it('does not delete outside the media directory', async () => {
    const otherDir = mkdtempSync(join(tmpdir(), 'other-'))
    const target = join(otherDir, 'keep.txt')
    writeFileSync(target, 'keep me')

    try {
      await deleteStoredFile(`../${otherDir.split('/').pop()}/keep.txt`)

      // The file outside the media directory is untouched.
      expect(existsSync(target)).toBe(true)
    } finally {
      rmSync(otherDir, { recursive: true, force: true })
    }
  })
})

describe('contentTypeForPath', () => {
  it('maps known extensions', () => {
    expect(contentTypeForPath('/x/photo.jpg')).toBe('image/jpeg')
    expect(contentTypeForPath('/x/photo.WEBP')).toBe('image/webp')
    expect(contentTypeForPath('/x/clip.mp4')).toBe('video/mp4')
    expect(contentTypeForPath('/x/clip.webm')).toBe('video/webm')
  })

  it('falls back to an opaque type rather than guessing', () => {
    expect(contentTypeForPath('/x/file.weird')).toBe('application/octet-stream')
  })
})
