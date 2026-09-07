// src/app/media/[filename]/route.ts
//
// Serves uploaded media from disk at /media/<filename>.
//
// Files are stored outside `public/`, so nothing is served automatically:
// this handler is the only way to read them, and it resolves every request
// through `resolveMediaPath`, which refuses to escape the media directory.
//
// Public and read-only — uploaded media is public content on a storefront.
// Access control, if it is ever needed, belongs here rather than in the
// storage layer.

import { NextResponse } from 'next/server'

import {
  buildFileEtag,
  contentTypeForPath,
  readMediaFile,
  resolveMediaPath,
} from '../../../lib/media/storage'

/** Stored filenames are unique per upload (see `buildStoredFilename`), so
 * a given URL always names the same bytes and can be cached hard. */
const CACHE_CONTROL = 'public, max-age=31536000, immutable'

export async function GET(
  request: Request,
  { params }: { params: { filename: string } },
): Promise<Response> {
  const path = await resolveMediaPath(params.filename)

  if (!path) {
    return new NextResponse('Not found', { status: 404 })
  }

  let file: Buffer
  try {
    file = await readMediaFile(path)
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('media read failed:', error)
    return new NextResponse('Not found', { status: 404 })
  }

  const etag = buildFileEtag(file)

  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  return new NextResponse(file, {
    status: 200,
    headers: {
      'Content-Type': contentTypeForPath(path),
      'Content-Length': String(file.length),
      'Cache-Control': CACHE_CONTROL,
      ETag: etag,
      // These files are user-supplied. Never let a browser sniff its way to
      // a different type, and never let one render as a document.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  })
}
