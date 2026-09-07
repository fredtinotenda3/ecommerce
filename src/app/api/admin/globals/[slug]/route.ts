// src/app/api/admin/globals/[slug]/route.ts
//
// PUT — replace one of the singleton globals: header, footer or settings.
//
// PUT rather than PATCH because each of these is edited and saved whole:
// nav items are an ordered list, and a partial update of an ordered list
// has no obvious meaning.
//
// Admin only.

import { NextResponse } from 'next/server'

import { saveFooter, saveHeader, saveSettings } from '../../../../_api/adminMutations'
import { requireAdmin } from '../../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../../_shared/respond'

export const dynamic = 'force-dynamic'

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const { denied } = await requireAdmin()
  if (denied) return denied

  try {
    const body = await readJsonBody(request)

    switch (params.slug) {
      case 'header':
        return NextResponse.json({ global: await saveHeader(body) })
      case 'footer':
        return NextResponse.json({ global: await saveFooter(body) })
      case 'settings':
        return NextResponse.json({ global: await saveSettings(body) })
      default:
        return NextResponse.json({ error: 'Unknown global.' }, { status: 404 })
    }
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
