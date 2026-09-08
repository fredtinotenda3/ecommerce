// src/app/(pages)/not-found.tsx
//
// The 404. A dead end is where a visitor decides whether to leave, so this
// gives them three ways to carry on rather than a bare "page not found".

import type { Metadata } from 'next'
import Link from 'next/link'

import { Gutter } from '../_components/Gutter'

import classes from './not-found.module.scss'

export const metadata: Metadata = {
  title: 'Page not found',
  // A 404 must never be indexed, whatever the site-wide setting.
  robots: { index: false, follow: true },
}

const SUGGESTIONS = [
  { href: '/products', label: 'Shop everything', detail: 'The full range, filterable' },
  { href: '/products?category=laptops', label: 'MacBooks', detail: 'Air and Pro' },
  { href: '/products?category=phones', label: 'iPhones', detail: 'Unlocked, network-free' },
]

export default function NotFound() {
  return (
    <Gutter>
      <div className={classes.wrap}>
        <p className={classes.code}>404</p>

        <h1 className={classes.heading}>We could not find that page</h1>

        <p className={classes.copy}>
          The link may be out of date, or the product may have sold out and been retired. Here is
          where most people were heading.
        </p>

        <ul className={classes.suggestions}>
          {SUGGESTIONS.map(suggestion => (
            <li key={suggestion.href}>
              <Link href={suggestion.href} className={classes.suggestion}>
                <span className={classes.suggestionLabel}>{suggestion.label}</span>
                <span className={classes.suggestionDetail}>{suggestion.detail}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12h14m-6-6 6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <p className={classes.help}>
          Still stuck? <Link href="/contact">Talk to someone</Link> — we answer six days a week.
        </p>
      </div>
    </Gutter>
  )
}
