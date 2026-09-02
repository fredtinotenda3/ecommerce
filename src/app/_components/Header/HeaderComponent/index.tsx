'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { StorefrontHeader } from '../../../_types/storefront'
import { noHeaderFooterUrls } from '../../../constants'
import { Gutter } from '../../Gutter'
import { HeaderNav } from '../Nav'

import classes from './index.module.scss'

// PHASE 13K: narrowed from `payload-types.ts`'s `Header` to
// `StorefrontHeader` — see the matching comment in ../Nav/index.tsx, which
// this component just forwards `header` on to unchanged.
const HeaderComponent = ({ header }: { header: StorefrontHeader | null }) => {
  // `header` may be `null` here (see src/app/_components/Header/index.tsx's
  // try/catch, e.g. when the native repository has no Header global yet) —
  // `HeaderNav` below already null-guards `header?.navItems`.
  //
  // PHASE 13D: `usePathname` must still be called unconditionally
  // (react-hooks/rules-of-hooks) — a crash inside it
  // ("Cannot read properties of null (reading 'useContext')") observed
  // during native server boot in a sandboxed environment with no Google
  // Fonts access (see PHASE13C_REPORT.md) is guarded against one level up:
  // this component is rendered inside an `ErrorBoundary` (see
  // src/app/_components/Header/index.tsx) so a render-phase throw here
  // degrades to no header/footer instead of crashing the whole page. That
  // crash was not confirmed to be caused by missing header/footer data or
  // by this component itself.
  const pathname = usePathname()

  return (
    <nav
      className={[classes.header, noHeaderFooterUrls.includes(pathname) && classes.hide]
        .filter(Boolean)
        .join(' ')}
    >
      <Gutter className={classes.wrap}>
        <Link href="/">
          <Image src="/logo-black.svg" alt="logo" width={170} height={50} />
        </Link>

        <HeaderNav header={header} />
      </Gutter>
    </nav>
  )
}

export default HeaderComponent
