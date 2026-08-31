{
  /* eslint-disable @next/next/no-img-element */
}

import React from 'react'
import Link from 'next/link'

import { Header } from '../../../payload/payload-types'
import { fetchHeader } from '../../_api/fetchGlobals'
import { ErrorBoundary } from '../ErrorBoundary'
import HeaderComponent from './HeaderComponent'

export async function Header() {
  let header: Header | null = null

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
