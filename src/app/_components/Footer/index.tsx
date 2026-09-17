import React from 'react'

import { fetchFooter, fetchSettings } from '../../_api/fetchGlobals'
import { StorefrontFooter, StorefrontSettingsLike } from '../../_types/storefront'
import { ErrorBoundary } from '../ErrorBoundary'
import FooterComponent from './FooterComponent'

export async function Footer() {
  // `footer`/`settings` are narrowed to their storefront types — see the
  // matching comment in ../Header/index.tsx for why this is safe.
  let footer: StorefrontFooter | null = null
  let settings: StorefrontSettingsLike | null = null

  try {
    ;[footer, settings] = await Promise.all([fetchFooter(), fetchSettings()])
  } catch (error) {
    console.error('footer read failed:', error)
  }

  return (
    <>
      {/* guards against a render-phase crash inside
          FooterComponent (see the crash documented in PHASE13C_REPORT.md)
          — see src/app/_components/ErrorBoundary/index.tsx. */}
      <ErrorBoundary>
        <FooterComponent footer={footer} settings={settings} />
      </ErrorBoundary>
    </>
  )
}
