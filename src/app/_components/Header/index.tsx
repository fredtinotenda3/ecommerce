{
  /* eslint-disable @next/next/no-img-element */
}

import React from 'react'
import Link from 'next/link'

import { fetchHeader } from '../../_api/fetchGlobals'
import { StorefrontHeader } from '../../_types/storefront'
import { ErrorBoundary } from '../ErrorBoundary'
import HeaderComponent from './HeaderComponent'

export async function Header() {
  // PHASE 13K: `header` is narrowed to `StorefrontHeader` (rather than
  // `payload-types.ts`'s `Header`) — `fetchHeader()`'s return type (Payload's
  // generated `Header`, on the default GraphQL path; the native path's cast
  // return value on the flag-gated path — see src/app/_api/fetchGlobals.ts)
  // is a structural superset of `StorefrontHeader` and is assignable to it
  // unchanged; only `HeaderComponent`/`HeaderNav` below actually read this
  // value, and both were narrowed the same way in this phase.
  let header: StorefrontHeader | null = null

  try {
    header = await fetchHeader()
  } catch (error) {
    console.log(error)
  }

  return (
    <>
      {/* PHASE 13D: guards against a render-phase crash inside
          HeaderComponent (see the crash documented in PHASE13C_REPORT.md)
          — see src/app/_components/ErrorBoundary/index.tsx. */}
      <ErrorBoundary>
        <HeaderComponent header={header} />
      </ErrorBoundary>
    </>
  )
}
