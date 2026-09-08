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

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import classes from './admin.module.scss'

export const ADMIN_SECTIONS: { href: string; title: string; description: string }[] = [
  {
    href: '/admin/products',
    title: 'Products',
    description: 'Create and edit products, set prices, publish or unpublish in bulk.',
  },
  {
    href: '/admin/categories',
    title: 'Categories',
    description: 'The category tree behind the product filters and the homepage tiles.',
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description: 'Fulfilment status across every customer, with valid transitions enforced.',
  },
  {
    href: '/admin/customers',
    title: 'Customers',
    description: 'Accounts, their orders, and role assignment.',
  },
  {
    href: '/admin/pages',
    title: 'Pages',
    description: 'CMS pages: hero, layout blocks and SEO metadata.',
  },
  {
    href: '/admin/media',
    title: 'Media',
    description: 'Upload images, fix alt text, remove files that are no longer used.',
  },
  {
    href: '/admin/globals',
    title: 'Globals',
    description: 'Header and footer navigation, and site settings.',
  },
  {
    href: '/admin/redirects',
    title: 'Redirects',
    description: 'Path redirects applied to incoming requests by the edge middleware.',
  },
]

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
