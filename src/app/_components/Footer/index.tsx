import React from 'react'
import Link from 'next/link'

import { Footer } from '../../../payload/payload-types'
import { fetchFooter } from '../../_api/fetchGlobals'
import { ErrorBoundary } from '../ErrorBoundary'
import FooterComponent from './FooterComponent'

export async function Footer() {
  let footer: Footer | null = null

  try {
    footer = await fetchFooter()
  } catch (error) {
    console.log(error)
  }

  const navItems = footer?.navItems || []

  return (
    <>
      {/* PHASE 13D: guards against a render-phase crash inside
          FooterComponent (see the crash documented in PHASE13C_REPORT.md)
          — see src/app/_components/ErrorBoundary/index.tsx. */}
      <ErrorBoundary>
        <FooterComponent footer={footer} />
      </ErrorBoundary>
    </>
  )
}
