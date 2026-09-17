{
  /* eslint-disable @next/next/no-img-element */
}

import React from 'react'

import { fetchHeader, fetchSettings } from '../../_api/fetchGlobals'
import { StorefrontHeader, StorefrontSettingsLike } from '../../_types/storefront'
import { ErrorBoundary } from '../ErrorBoundary'
import HeaderComponent from './HeaderComponent'

export async function Header() {
  // Null is a normal state (no Header/Settings global yet); the components
  // below render their own fallback for it.
  let header: StorefrontHeader | null = null
  let settings: StorefrontSettingsLike | null = null

  try {
    ;[header, settings] = await Promise.all([fetchHeader(), fetchSettings()])
  } catch (error) {
    console.error('header read failed:', error)
  }

  return (
    <>
      {/* guards against a render-phase crash inside
          HeaderComponent (see the crash documented in PHASE13C_REPORT.md)
          — see src/app/_components/ErrorBoundary/index.tsx. */}
      <ErrorBoundary>
        <HeaderComponent header={header} settings={settings} />
      </ErrorBoundary>
    </>
  )
}
