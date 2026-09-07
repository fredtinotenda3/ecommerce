// src/app/api/account/route.ts
//
// PATCH /api/account — the authenticated customer updates their own record:
// profile fields (name/email/password) and/or their cart.
//
// The account being written is always the one in the session; no id is read
// from the body or the URL. Roles and purchases are not writable here — see
// src/app/_api/account.ts.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { AccountUpdateError, updateCart, updateProfile } from '../../_api/account'
import { getAuthenticatedUser } from '../../_api/authenticatedUser'

export const dynamic = 'force-dynamic'

interface AccountPatchBody {
  name?: unknown
  email?: unknown
  password?: unknown
  cart?: { items?: unknown } | null
}

export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 })
  }

  let body: AccountPatchBody
  try {
    body = (await request.json()) as AccountPatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    let updated = null

    if (body.cart && Array.isArray(body.cart.items)) {
      updated = await updateCart(user.id, body.cart.items as { product?: unknown }[])
    }

    const wantsProfileUpdate =
      typeof body.name === 'string' ||
      typeof body.email === 'string' ||
      (typeof body.password === 'string' && body.password.length > 0)

    if (wantsProfileUpdate) {
      updated = await updateProfile(user.id, {
        name: body.name,
        email: body.email,
        password: body.password,
      })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    return NextResponse.json({ user: updated })
  } catch (error: unknown) {
    if (error instanceof AccountUpdateError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    // eslint-disable-next-line no-console
    console.error('account update failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
