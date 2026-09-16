// src/app/api/admin/media/route.ts
//
// POST — upload a file (multipart/form-data: `file`, optional `alt`).
//
// The request is read as form data rather than JSON so the browser can
// stream the file. Size, declared type and the file's own magic number are
// all checked before anything is written — see src/lib/media/storage.ts.
//
// Admin only: uploads write to the server's disk, so this must never be
// reachable by a customer.

import { NextResponse } from 'next/server'

import { uploadMedia } from '../../../_api/adminMutations'
import { requireAdmin } from '../../../_api/requireAdmin'
import { MAX_VIDEO_UPLOAD_BYTES, maxUploadBytesFor } from '../../../../lib/media/storage'
import { adminErrorResponse } from '../_shared/respond'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    // A first, cheap rejection from the declared `content-length` header,
    // before the multipart body is parsed at all. This has to use the
    // *largest* ceiling of any allowed type (video's) rather than the
    // per-type one, since the type itself is only known once the body is
    // parsed a few lines down — it exists only to stop a wildly oversized
    // body from being buffered into memory in the first place. The real,
    // per-type limit (`maxUploadBytesFor`) is enforced right after, against
    // the file's actual declared type, and again inside `storeUpload`
    // against its real byte count — a client controls both this header and
    // the file's declared `type`, so neither is trusted on its own.
    const declaredLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_VIDEO_UPLOAD_BYTES * 1.1) {
      return NextResponse.json({ error: 'That file is too large.' }, { status: 413 })
    }

    const form = await request.formData()
    const file = form.get('file')

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 })
    }

    if (file.size > maxUploadBytesFor(file.type) * 1.1) {
      const limitMb = Math.floor(maxUploadBytesFor(file.type) / (1024 * 1024))
      return NextResponse.json({ error: `That file is too large. Limit: ${limitMb}MB.` }, { status: 413 })
    }

    const altValue = form.get('alt')
    const alt = typeof altValue === 'string' && altValue.trim() ? altValue.trim() : file.name

    const media = await uploadMedia({
      buffer: Buffer.from(await file.arrayBuffer()),
      originalName: file.name,
      mimeType: file.type,
      alt,
    })

    return NextResponse.json({ media }, { status: 201 })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
