'use client'

// src/app/(admin)/admin/_components/AdminNav.tsx
//
// The admin's section navigation. A client component solely so the current
// section can be marked — `usePathname` is not available on the server, and
// a navigation with no current-page indicator leaves the operator guessing
// where they are.
//
// `aria-current="page"` carries that to assistive technology; the colour
// alone would not.
//
// The section list itself lives in `./sections.ts`, a module with no
// 'use client' directive, so the server-rendered dashboard can import the
// same array without dotting into a client module.

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import classes from './admin.module.scss'
import { ADMIN_SECTIONS } from './sections'

export const AdminNav: React.FC = () => {
  const pathname = usePathname() || ''

  return (
    <nav className={classes.nav} aria-label="Admin sections">
      {ADMIN_SECTIONS.map(section => {
        const isActive = pathname === section.href || pathname.startsWith(`${section.href}/`)

        return (
          <Link
            key={section.href}
            href={section.href}
            className={[classes.navLink, isActive && classes.navLinkActive]
              .filter(Boolean)
              .join(' ')}
            aria-current={isActive ? 'page' : undefined}
          >
            {section.title}
          </Link>
        )
      })}
    </nav>
  )
}
