// src/lib/media/storage.ts
//
// Local filesystem storage for uploaded media.
//
// Files live in a directory outside `public/` (default `<cwd>/media`,
// overridable with `MEDIA_DIR`) and are served by a route handler rather
// than as static assets. That is deliberate: anything dropped in `public/`
// is served by the framework with no say from the application, so an
// upload directory there is one bug away from serving whatever a user
// managed to write into it.
//
// Existing files from before this change are preserved: `resolveMediaPath`
// searches the configured directory first and then `public/media`, which
// is where the previous CMS wrote uploads.
//
// Everything here is filesystem-only; database records are the caller's
// job (see src/app/_api/adminMutations.ts).

import { createHash, randomBytes } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import {
  extname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from 'path'

import { type ImageDimensions, readImageDimensions } from './imageDimensions'

export class MediaUploadError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'MediaUploadError'
    this.status = status
  }
}

/** Upload size ceiling. A request larger than this is refused before the
 * body is buffered into memory where possible, and always before it
 * reaches the disk. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

/** Accepted types, mapped to the extension the stored file gets.
 *
 * SVG is deliberately absent: an SVG is a document that can carry script,
 * and these files are served from the application's own origin, so an
 * uploaded SVG would be a stored-XSS vector against any logged-in user who
 * opened it. Supporting SVG safely needs sanitising or an isolated origin,
 * which is a bigger change than an allow-list entry. */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
}

/** Magic-number prefixes, checked against the declared type. A client
 * controls the `Content-Type` it sends; the first bytes of the file are
 * harder to lie about, and disagreement between the two is exactly the
 * shape of a "picture" that is really something else. */
const MAGIC_NUMBERS: { mime: string; matches: (buffer: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', matches: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 },
  { mime: 'image/png', matches: b => b.length > 8 && b.readUInt32BE(0) === 0x89504e47 },
  { mime: 'image/gif', matches: b => b.length > 6 && b.toString('ascii', 0, 3) === 'GIF' },
  {
    mime: 'image/webp',
    matches: b =>
      b.length > 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mime: 'image/avif',
    matches: b => b.length > 12 && b.toString('ascii', 4, 8) === 'ftyp',
  },
]

export const getMediaDir = (): string =>
  resolve(process.env.MEDIA_DIR || join(process.cwd(), 'media'))

/** Where files written by the previous CMS live. Read-only fallback so
 * existing media keeps resolving after this change. */
const getLegacyMediaDir = (): string => resolve(join(process.cwd(), 'public', 'media'))

/** True when `candidate` is `dir` itself or sits inside it.
 *
 * Uses `path.relative` rather than a string prefix: on Windows both
 * `resolve()` and `join()` produce backslashes, so a `startsWith(`${dir}/`)`
 * check never matches and every lookup fails. `relative` answers the same
 * question in the platform's own terms — an empty result means "same
 * directory", and anything that escapes starts with `..`.
 *
 * The `isAbsolute` guard matters on Windows: `relative('C:\\media', 'D:\\x')`
 * returns an absolute path rather than a `..` chain, so a different drive
 * would otherwise read as contained. */
const isInside = (dir: string, candidate: string): boolean => {
  const rel = relative(dir, candidate)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Strips everything but the stem of the original name, then appends
 * random bytes and the extension implied by the *verified* content type.
 *
 * The original name never reaches the filesystem intact: it is attacker-
 * controlled, and path separators, `..`, leading dots and NUL bytes in it
 * are all ways to write outside the upload directory. The random suffix
 * also means two uploads of "photo.jpg" cannot overwrite one another. */
export const buildStoredFilename = (originalName: string, mimeType: string): string => {
  const extension = ALLOWED_MIME_TYPES[mimeType]
  if (!extension) throw new MediaUploadError(`Unsupported file type: ${mimeType}`, 415)

  const segments = originalName.replace(/\\/g, '/').split('/')
  const lastSegment = segments[segments.length - 1] ?? ''

  const base = lastSegment
    .replace(extname(originalName), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

  const stem = base.length > 0 ? base : 'upload'

  return `${stem}-${randomBytes(6).toString('hex')}${extension}`
}

/** Resolves a request path to a file inside one of the media directories,
 * or `null` if it does not exist.
 *
 * The containment check is the important part: `normalize` collapses any
 * `..` segments, and the result must still sit under the directory it was
 * resolved against. Without it, `/media/../../etc/passwd` reads whatever
 * the process can read. */
export const resolveMediaPath = async (filename: string): Promise<string | null> => {
  if (!filename || filename.includes('\0')) return null

  // Strip leading separators of either flavour before normalizing, so a
  // request for `/photo.png` is treated as relative to the media directory
  // instead of as an absolute filesystem path.
  const requested = normalize(filename.replace(/^[/\\]+/, ''))
  if (requested.split(/[/\\]/).includes('..')) return null

  for (const dir of [getMediaDir(), getLegacyMediaDir()]) {
    const candidate = resolve(join(dir, requested))
    if (!isInside(dir, candidate)) continue

    try {
      const stats = await stat(candidate)
      if (stats.isFile()) return candidate
    } catch {
      // Not in this directory; try the next.
    }
  }

  return null
}

export interface StoredUpload {
  filename: string
  url: string
  mimeType: string
  filesize: number
  width: number | null
  height: number | null
}

/** Validates and writes an upload, returning what the database record
 * needs. The declared type must be allowed AND agree with the file's own
 * magic number. */
export const storeUpload = async (
  buffer: Buffer,
  originalName: string,
  declaredMimeType: string,
): Promise<StoredUpload> => {
  if (buffer.length === 0) throw new MediaUploadError('The uploaded file is empty.')
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new MediaUploadError(
      `Files must be ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB or smaller.`,
      413,
    )
  }

  const mimeType = declaredMimeType.split(';')[0].trim().toLowerCase()
  if (!ALLOWED_MIME_TYPES[mimeType]) {
    throw new MediaUploadError(
      `Unsupported file type "${mimeType}". Allowed: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}.`,
      415,
    )
  }

  const signature = MAGIC_NUMBERS.find(entry => entry.mime === mimeType)
  if (signature && !signature.matches(buffer)) {
    throw new MediaUploadError(`That file is not a valid ${mimeType} image.`, 415)
  }

  const filename = buildStoredFilename(originalName, mimeType)
  const dir = getMediaDir()

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const destination = join(dir, filename)
  await writeFile(destination, buffer, { flag: 'wx' })

  const dimensions: ImageDimensions | null = readImageDimensions(buffer)

  return {
    filename,
    url: `/media/${filename}`,
    mimeType,
    filesize: buffer.length,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  }
}

/** Removes a stored file. Missing is treated as success: the caller is
 * deleting the database record either way, and a file that is already gone
 * is the state being asked for.
 *
 * Only ever deletes from the configured upload directory — never from the
 * legacy `public/media` fallback, which may hold files this application
 * did not write. */
export const deleteStoredFile = async (filename: string): Promise<void> => {
  if (!filename || filename.includes('\0')) return

  const requested = normalize(filename.replace(/^[/\\]+/, ''))
  if (requested.split(/[/\\]/).includes('..')) return

  const dir = getMediaDir()
  const target = resolve(join(dir, requested))
  if (!isInside(dir, target) || target === dir) return

  try {
    await unlink(target)
  } catch {
    // Already gone.
  }
}

/** Weak ETag over the file's bytes, so a browser revalidating an unchanged
 * file gets a 304 rather than the whole image again. */
export const buildFileEtag = (buffer: Buffer): string =>
  `W/"${createHash('sha1').update(buffer).digest('hex')}"`

export const readMediaFile = async (path: string): Promise<Buffer> => readFile(path)

/** Content type from the stored extension. The extension was chosen by
 * `buildStoredFilename` from a verified mime type, so this cannot be
 * steered by an uploader — and anything unrecognised is served as an
 * opaque download rather than guessed at. */
export const contentTypeForPath = (path: string): string => {
  const byExtension: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
  }

  return byExtension[extname(path).toLowerCase()] ?? 'application/octet-stream'
}