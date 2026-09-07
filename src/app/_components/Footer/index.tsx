import React from 'react'

import { fetchFooter } from '../../_api/fetchGlobals'
import { StorefrontFooter } from '../../_types/storefront'
import { ErrorBoundary } from '../ErrorBoundary'
import FooterComponent from './FooterComponent'

export async function Footer() {
  // `footer` is narrowed to `StorefrontFooter` — see the
  // matching comment in ../Header/index.tsx for why this is safe.
  let footer: StorefrontFooter | null = null

  try {
    footer = await fetchFooter()
  } catch (error) {
    console.error('footer read failed:', error)
  }

  return (
    <>
      {/* guards against a render-phase crash inside
          FooterComponent (see the crash documented in PHASE13C_REPORT.md)
          — see src/app/_components/ErrorBoundary/index.tsx. */}
      <ErrorBoundary>
        <FooterComponent footer={footer} />
      </ErrorBoundary>
    </>
  )
}
