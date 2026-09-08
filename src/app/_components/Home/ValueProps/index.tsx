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
 * are still used in the footer, at the size they were drawn for. */
const ICONS: Record<string, React.ReactNode> = {
  'Free delivery': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7h10v9H3zM13 10h4l3 3v3h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="18" r="1.8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  '30-day returns': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11a8 8 0 1 1 2.3 5.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M4 5v6h6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  'Real humans': (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12a8 8 0 0 1 16 0v4a3 3 0 0 1-3 3h-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="2.5" y="11" width="4" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="17.5" y="11" width="4" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
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
}

export const ValueProps: React.FC = () => (
  <section className={classes.section} aria-labelledby="value-heading">
    <Gutter>
      <div className={classes.header}>
        <p className={classes.eyebrow}>Why Tech Haven</p>
        <h2 id="value-heading" className={classes.heading}>
          The part most shops leave out
        </h2>
      </div>

      <ul className={classes.grid}>
        {INCLUSIONS.map(inclusion => (
          <li key={inclusion.title} className={classes.item}>
            <span className={classes.icon}>{ICONS[inclusion.title] ?? ICONS['Real humans']}</span>
            <h3 className={classes.itemTitle}>{inclusion.title}</h3>
            <p className={classes.itemCopy}>{inclusion.description}</p>
          </li>
        ))}
      </ul>
    </Gutter>
  </section>
)
