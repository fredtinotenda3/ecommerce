'use client'

// src/app/_components/Header/Nav/index.tsx
//
// Renders whatever nav items are configured in the Header global.
//
// These are supplementary: the fixed shop navigation lives in
// `PRIMARY_NAV` (constants/brand.ts) and is rendered by the header itself,
// so an empty or half-configured Header global cannot leave the site
// without navigation.

import React from 'react'

import { StorefrontHeader } from '../../../_types/storefront'
import { CMSLink } from '../../Link'

import classes from './index.module.scss'

export const HeaderNav: React.FC<{ header: StorefrontHeader | null; className?: string }> = ({
  header,
  className,
}) => {
  const navItems = header?.navItems || []

  if (navItems.length === 0) return null

  return (
    <nav className={[classes.nav, className].filter(Boolean).join(' ')} aria-label="More">
      {navItems.map(({ link }, i) => (
        <CMSLink key={i} {...link} appearance="none" />
      ))}
    </nav>
  )
}
