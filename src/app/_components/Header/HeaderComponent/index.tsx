'use client'

// src/app/_components/Header/HeaderComponent/index.tsx
//
// The site header: brand lockup, primary navigation, search, cart and
// account.
//
// It sticks to the top of the viewport, which is what makes the cart
// reachable from anywhere in a long product grid. The mobile drawer
// renders the same nav list as the desktop bar, so the two cannot describe
// different shops.
//
// NAVIGATION IS ADMIN-MANAGED. The Header global's `navItems` (edited at
// `/admin/globals`) are the shop's actual navigation — there is no more
// hardcoded `PRIMARY_NAV` list living in source. A brand-new install with
// no Header global configured yet (or one an operator has emptied out)
// falls back to `MINIMAL_NAV_FALLBACK` — one generic "Shop" link — so the
// header is never nav-less, without baking any specific business's
// categories into the code.
//
// `usePathname` is called unconditionally (react-hooks/rules-of-hooks) and
// this component is rendered inside an `ErrorBoundary` one level up, so a
// render-phase failure degrades to no header rather than a blank page.

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { DEFAULT_SITE_NAME, MINIMAL_NAV_FALLBACK } from '../../../../lib/domain/siteDefaults'
import { useAuth } from '../../../_providers/Auth'
import { noHeaderFooterUrls } from '../../../constants'
import { StorefrontHeader, StorefrontSettingsLike } from '../../../_types/storefront'
import { resolveCMSLinkHref } from '../../Link/resolveHref'
import { CartLink } from '../../CartLink'
import { Gutter } from '../../Gutter'
import { Logo } from '../../Logo'
import { SearchField } from '../../SearchField'
import { ThemeToggle } from '../../ThemeToggle'

import classes from './index.module.scss'

interface ResolvedNavItem {
  key: string
  label: string
  href: string
  newTab?: boolean
}

/** Header global nav items, resolved to a plain `{ label, href }` list the
 * rest of this component can render and active-match without caring how
 * each link was configured (a page reference vs. a typed url). Falls back
 * to `MINIMAL_NAV_FALLBACK` only when every item was unusable (no label, or
 * no resolvable href) — same "half-configured is not the same as
 * unconfigured, but both need a safety net" treatment the admin form's own
 * validation gives a single bad entry. */
const resolveNavItems = (header: StorefrontHeader | null): ResolvedNavItem[] => {
  const resolved = (header?.navItems ?? [])
    .map((item, index): ResolvedNavItem | null => {
      const href = resolveCMSLinkHref(item.link)
      const label = item.link.label
      if (!href || !label) return null
      return { key: `${href}-${index}`, label, href, newTab: item.link.newTab }
    })
    .filter((item): item is ResolvedNavItem => item !== null)

  return resolved.length > 0
    ? resolved
    : MINIMAL_NAV_FALLBACK.map(item => ({ key: item.href, label: item.label, href: item.href }))
}

const HeaderComponent = ({
  header,
  settings,
}: {
  header: StorefrontHeader | null
  settings: StorefrontSettingsLike | null
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const navItems = resolveNavItems(header)
  const siteName = settings?.siteName || DEFAULT_SITE_NAME

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
        <Link href="/" className={classes.brand} aria-label={`${siteName} home`}>
          <Logo variant="auto" priority />
        </Link>

        <nav className={classes.primaryNav} aria-label="Primary">
          {navItems.map(item => (
            <Link
              key={item.key}
              href={item.href}
              target={item.newTab ? '_blank' : undefined}
              rel={item.newTab ? 'noopener noreferrer' : undefined}
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
              {navItems.map(item => (
                <Link
                  key={item.key}
                  href={item.href}
                  target={item.newTab ? '_blank' : undefined}
                  rel={item.newTab ? 'noopener noreferrer' : undefined}
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
          </Gutter>
        </div>
      )}
    </header>
  )
}

export default HeaderComponent
