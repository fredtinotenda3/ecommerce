{
  /* eslint-disable @next/next/no-img-element */
}

import React from 'react'

import { fetchHeader } from '../../_api/fetchGlobals'
import { StorefrontHeader } from '../../_types/storefront'
import { ErrorBoundary } from '../ErrorBoundary'
import HeaderComponent from './HeaderComponent'

export async function Header() {
  // Null is a normal state (no Header global yet); the components below
  // render their own fallback for it.
  let header: StorefrontHeader | null = null

  try {
    header = await fetchHeader()
  } catch (error) {
    console.error('header read failed:', error)
  }

  return (
    <>
      {/* guards against a render-phase crash inside
          HeaderComponent (see the crash documented in PHASE13C_REPORT.md)
          — see src/app/_components/ErrorBoundary/index.tsx. */}
      <ErrorBoundary>
        <HeaderComponent header={header} />
      </ErrorBoundary>
    </>
  )
}
