'use client'

// src/app/_components/Home/Deals/index.tsx
//
// "Deals of the Month": copy and a countdown on the left, the supplied
// product shot floated to the right.
//
// The countdown is the only reason this is a client component. It counts to
// the end of the current calendar month, which is a real, checkable claim —
// the previous implementation counted to "three days from whenever the
// component mounted", which resets for every visitor and is therefore not a
// deadline at all.
//
// Hydration: the target is derived from the current month rather than held
// in state, and the digits render as em dashes until the first client tick.
// Rendering a live time on the server would produce markup that cannot
// match the client's, which React reports as a hydration error.

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

/** Midnight at the start of the next month, in the visitor's own timezone. */
const endOfMonth = (from: Date): Date =>
  new Date(from.getFullYear(), from.getMonth() + 1, 1, 0, 0, 0, 0)

const remainingFrom = (now: Date): Remaining => {
  const difference = Math.max(endOfMonth(now).getTime() - now.getTime(), 0)

  return {
    days: Math.floor(difference / 86_400_000),
    hours: Math.floor((difference % 86_400_000) / 3_600_000),
    minutes: Math.floor((difference % 3_600_000) / 60_000),
    seconds: Math.floor((difference % 60_000) / 1000),
  }
}

const Unit = ({ value, label }: { value: number | null; label: string }) => (
  <li className={classes.unit}>
    <span className={classes.unitValue}>
      {value === null ? '––' : String(value).padStart(2, '0')}
    </span>
    <span className={classes.unitLabel}>{label}</span>
  </li>
)

export const Deals: React.FC = () => {
  const [remaining, setRemaining] = useState<Remaining | null>(null)

  useEffect(() => {
    const tick = () => setRemaining(remainingFrom(new Date()))

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className={classes.section} aria-labelledby="deals-heading">
      <Gutter>
        <div className={classes.panel}>
          <div className={classes.panelWash} aria-hidden="true" />

          {/* Floated rather than laid out in a grid: the brief asks for the
              image to sit right with the copy wrapping around it, which is
              what a float does and what a grid column does not. It becomes
              a normal block below the mid breakpoint. */}
          <div className={classes.art}>
            <Image
              src="/media/14-inch-macbook-pro-12-core-1tb-space-black.png"
              alt="14-inch MacBook Pro in space black"
              width={1914}
              height={1148}
              sizes="(max-width: 767px) 88vw, 42vw"
              quality={88}
              className={classes.artImage}
            />
          </div>

          <p className={classes.eyebrow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
            </svg>
            Deals of the month
          </p>

          <h2 id="deals-heading" className={classes.heading}>
            Up to 15% off selected MacBooks and iPhones
          </h2>

          <p className={classes.copy}>
            Every reduction is measured against the price we charged last month — not against a
            recommended retail price nobody pays. Warranty and free delivery apply to discounted
            stock exactly as they do to everything else.
          </p>

          <span className={classes.countdownLabel}>Offer ends in</span>

          <ul className={classes.countdown} aria-label="Time remaining in this month's offer">
            <Unit value={remaining?.days ?? null} label="Days" />
            <Unit value={remaining?.hours ?? null} label="Hours" />
            <Unit value={remaining?.minutes ?? null} label="Minutes" />
            <Unit value={remaining?.seconds ?? null} label="Seconds" />
          </ul>

          <div className={classes.actions}>
            <Link href="/products?sort=price-asc" className={classes.cta}>
              See what is reduced
            </Link>
            <Link href="/products" className={classes.ctaGhost}>
              Shop everything
            </Link>
          </div>
        </div>
      </Gutter>
    </section>
  )
}
