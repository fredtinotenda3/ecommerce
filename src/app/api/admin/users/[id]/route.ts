// src/app/api/admin/users/[id]/route.ts
//
// PATCH — change a user's roles.
//
// The acting administrator's id comes from the session, never the request:
// the rules that stop an operator demoting themselves or removing the last
// admin depend on knowing who is really acting.
//
// Admin only.

import { NextResponse } from 'next/server'

import { updateUserRoles } from '../../../../_api/adminMutations'
import { requireAdmin } from '../../../../_api/requireAdmin'
import { adminErrorResponse, readJsonBody } from '../../_shared/respond'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const { denied, user } = await requireAdmin()
  if (denied || !user) return denied ?? NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const body = await readJsonBody(request)
    const updated = await updateUserRoles(params.id, body.roles, user.id)
    return NextResponse.json({ user: updated })
  } catch (error: unknown) {
    return adminErrorResponse(error)
  }
}
