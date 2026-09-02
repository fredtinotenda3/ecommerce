'use client'

import React from 'react'
import Link from 'next/link'

import { useAuth } from '../../../_providers/Auth'
import { StorefrontHeader } from '../../../_types/storefront'
import { Button } from '../../Button'
import { CartLink } from '../../CartLink'
import { CMSLink } from '../../Link'

import classes from './index.module.scss'

// PHASE 13K: narrowed from `payload-types.ts`'s `Header` to
// `StorefrontHeader` (src/app/_types/storefront.ts) — this component only
// ever reads `.navItems[].link`, spread straight into `CMSLink`. Every real
// `payload-types.ts` `Header` (the default GraphQL path), and everything
// the native `globalsStorefrontAdapter.ts`/`fetchGlobalsNative.ts` path
// produces (see src/app/_api/fetchGlobals.ts), satisfies this unchanged.
export const HeaderNav: React.FC<{ header: StorefrontHeader | null }> = ({ header }) => {
  const navItems = header?.navItems || []
  const { user } = useAuth()

  return (
    <nav className={[classes.nav, user === undefined && classes.hide].filter(Boolean).join(' ')}>
      {navItems.map(({ link }, i) => {
        return <CMSLink key={i} {...link} appearance="none" />
      })}
      <CartLink />
      {user && <Link href="/account">Account</Link>}
      {!user && (
        <Button
          el="link"
          href="/login"
          label="Login"
          appearance="primary"
          onClick={() => (window.location.href = '/login')}
        />
      )}
      {user && <CartLink />}
    </nav>
  )
}
