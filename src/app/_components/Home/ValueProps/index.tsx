// src/app/_components/Home/ValueProps/index.tsx
//
// The "why buy here" band.
//
// It exists because the homepage otherwise went straight from a promotion to
// social proof, with nothing between the offer and the testimonials
// answering the obvious question a first-time visitor has: why you and not
// the shop down the road.
//
// The four promises were already written and already rendered — but only in
// the footer, below the fold of a long page, where nobody deciding whether
// to buy will ever read them. This puts them where they do work, and the
// footer keeps its copy as a reminder rather than as the only place they
// appear.
//
// Server component: static copy and inline SVG, no interactivity.

import React from 'react'

import { INCLUSIONS } from '../../../constants/brand'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

/** Line-art glyphs rather than the supplied filled icon set: at this size a
 * stroked icon inheriting `currentColor` stays crisp and re-colours itself
 * for the dark theme, where a fixed-colour raster cannot. The supplied icons
 * are still used in the footer, at the size they were drawn for.
 *
 * Keyed to the exact `INCLUSIONS` titles in constants/brand.ts — these are
 * Terro's own four promises, not Tech Haven's ('Free delivery', '30-day
 * returns' and 'Real humans' no longer exist as inclusions, so their old
 * icons here would silently never match and every item would fall through
 * to the same default glyph). */
const ICONS: Record<string, React.ReactNode> = {
  'Boxed & preloved stock': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 7.5V16l9 4.5 9-4.5V7.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12v8.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  'Repairs & accessories': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5l-6 6 2.4 2.4 6-6a4 4 0 0 0 5-5.4l-2.6 2.6-2-.5-.5-2 2.6-2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  'Pay with Paynow': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="5.5"
        width="19"
        height="13"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 14.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  'Message us directly': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16v10H9l-4 3.5v-3.5H4V5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

/** Falls back to a plain check when a future edit to `INCLUSIONS` adds a
 * title with no matching glyph above, rather than silently reusing
 * whichever icon happens to be first in the map. */
const DEFAULT_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="m5 12.5 4.5 4.5L19 7.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const ValueProps: React.FC = () => (
  <section className={classes.section} aria-labelledby="value-heading">
    <Gutter>
      <div className={classes.header}>
        <p className={classes.eyebrow}>Why Terro Technology</p>
        <h2 id="value-heading" className={classes.heading}>
          The part most shops leave out
        </h2>
      </div>

      <ul className={classes.grid}>
        {INCLUSIONS.map(inclusion => (
          <li key={inclusion.title} className={classes.item}>
            <span className={classes.icon}>{ICONS[inclusion.title] ?? DEFAULT_ICON}</span>
            <h3 className={classes.itemTitle}>{inclusion.title}</h3>
            <p className={classes.itemCopy}>{inclusion.description}</p>
          </li>
        ))}
      </ul>
    </Gutter>
  </section>
)
