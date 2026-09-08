'use client'

// src/app/_components/Header/HeaderComponent/index.tsx
//
// The site header: brand lockup, primary navigation, search, cart and
// account.
//
// It sticks to the top of the viewport, which is what makes the cart
// reachable from anywhere in a long product grid. The mobile drawer
// renders the same `PRIMARY_NAV` list as the desktop bar, so the two
// cannot describe different shops.
//
// `usePathname` is called unconditionally (react-hooks/rules-of-hooks) and
// this component is rendered inside an `ErrorBoundary` one level up, so a
// render-phase failure degrades to no header rather than a blank page.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { useAuth } from '../../../_providers/Auth'
import { noHeaderFooterUrls } from '../../../constants'
import { PRIMARY_NAV } from '../../../constants/brand'
import { StorefrontHeader } from '../../../_types/storefront'
import { CartLink } from '../../CartLink'
import { Gutter } from '../../Gutter'
import { Logo } from '../../Logo'
import { SearchField } from '../../SearchField'
import { ThemeToggle } from '../../ThemeToggle'
import { HeaderNav } from '../Nav'

import classes from './index.module.scss'

const HeaderComponent = ({ header }: { header: StorefrontHeader | null }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Close the drawer on navigation: leaving it open over the new page is
  // the classic mobile-menu bug.
  useEffect(() => {
    setIsDrawerOpen(false)
  }, [pathname])

  // While the drawer is open the page behind it must not scroll.
  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [isDrawerOpen])

  useEffect(() => {
    if (!isDrawerOpen) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawerOpen])

  if (noHeaderFooterUrls.includes(pathname)) return null

  // A nav item is current when its path matches AND its category matches.
  //
  // The previous rule treated any path under /products as a match for every
  // /products link, so on a product page all five nav items — "Shop all",
  // "Laptops", "Phones", "Tablets", "Audio" — were marked current at once.
  // That is wrong visually and actively misleading to a screen reader,
  // which announces every one of them as the current page.
  const isActive = (href: string): boolean => {
    const [path, query] = href.split('?')
    const itemCategory = new URLSearchParams(query || '').get('category')

    if (path !== '/products') return pathname === path

    // A product detail page is under /products but is not the listing, so
    // no listing link is "current" there.
    if (pathname !== '/products') return false

    const activeCategory = searchParams?.get('category') ?? null
    return itemCategory === activeCategory
  }

  return (
    <header className={classes.header}>
      <Gutter className={classes.wrap}>
        <Link href="/" className={classes.brand} aria-label="Tech Haven home">
          <Logo variant="auto" priority />
        </Link>

        <nav className={classes.primaryNav} aria-label="Primary">
          {PRIMARY_NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={[classes.navLink, isActive(item.href) && classes.navLinkActive]
                .filter(Boolean)
                .join(' ')}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={classes.actions}>
          <SearchField className={classes.search} />

          <ThemeToggle className={classes.themeToggle} />

          <Link
            href={user ? '/account' : '/login'}
            className={[classes.iconLink, classes.accountLink].join(' ')}
            aria-label={user ? 'Your account' : 'Sign in'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className={classes.iconLabel}>{user ? 'Account' : 'Sign in'}</span>
          </Link>

          <CartLink className={classes.cart} />

          <button
            type="button"
            className={classes.menuButton}
            aria-expanded={isDrawerOpen}
            aria-controls="mobile-nav"
            aria-label={isDrawerOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setIsDrawerOpen(open => !open)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {isDrawerOpen ? (
                <path
                  d="m6 6 12 12M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </Gutter>

      {isDrawerOpen && (
        <div className={classes.drawer} id="mobile-nav">
          <Gutter>
            <SearchField className={classes.drawerSearch} />

            <nav aria-label="Mobile">
              {PRIMARY_NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[classes.drawerLink, isActive(item.href) && classes.drawerLinkActive]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.label}
                </Link>
              ))}

              <Link href={user ? '/account' : '/login'} className={classes.drawerLink}>
                {user ? 'Your account' : 'Sign in'}
              </Link>
              <Link href="/cart" className={classes.drawerLink}>
                Cart
              </Link>
            </nav>

            <div className={classes.drawerTheme}>
              <span className={classes.drawerThemeLabel}>Appearance</span>
              <ThemeToggle variant="segmented" />
            </div>

            {/* Any nav items configured in the CMS globals appear beneath
                the fixed list rather than replacing it, so a half-configured
                Header global cannot leave the site without navigation. */}
            <HeaderNav header={header} className={classes.drawerCmsNav} />
          </Gutter>
        </div>
      )}
    </header>
  )
}

export default HeaderComponent
