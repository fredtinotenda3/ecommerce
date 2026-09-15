// src/app/_components/Home/Deals/index.tsx
//
// Custom Gaming PC spotlight (formerly "Deals of the Month").
//
// The previous version of this band counted down to "up to 15% off selected
// MacBooks and iPhones" — a discount with no supporting price history
// anywhere in the supplied assets, against a product (a 14" MacBook Pro)
// that is not in this catalogue at all. Inventing a "was" price to make a
// countdown honest is exactly what the brief rules out, so the countdown
// mechanic is gone rather than re-pointed at a different fake number.
//
// What replaces it is the one thing in the catalogue this treatment
// actually fits: the custom-built gaming PC (see
// scripts/seed/catalogue.ts, `custom-gaming-pc-ryzen-5-rtx`). It is
// genuinely quote-based — Terro's own flyer for it has no fixed price
// either — so "tell us your budget" is the honest pitch, not a euphemism
// for one. The floated photograph is the same build's own photo
// (`category-gaming.jpg`), not a stand-in.
//
// Server component: the countdown was the only thing requiring client
// state, so removing it removes the 'use client' boundary too.

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { CONTACT } from '../../../constants/brand'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

const WHATSAPP_QUOTE_HREF = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(
  'Hi Terro, I would like a quote for a custom gaming PC.',
)}`

/** Three checkable facts about the build service, styled where the
 * countdown digits used to sit. No invented turnaround time or warranty
 * term — see body copy in catalogue.ts for what is and isn't promised. */
const SPECS = ['Ryzen 5 or Ryzen 7', 'RTX-class GPU options', 'Assembled & tested in-store']

export const Deals: React.FC = () => (
  <section className={classes.section} aria-labelledby="deals-heading">
    <Gutter>
      <div className={classes.panel}>
        <div className={classes.panelWash} aria-hidden="true" />

        {/* Floated rather than laid out in a grid: the copy wraps around
            the photograph, which is what a float does and a grid column
            does not. It becomes a normal block below the mid breakpoint. */}
        <div className={classes.art}>
          <Image
            src="/media/category-gaming.jpg"
            alt="A custom gaming PC with a tempered-glass side panel and red interior lighting, beside its monitor and keyboard"
            width={1080}
            height={524}
            sizes="(max-width: 767px) 88vw, 42vw"
            quality={88}
            className={classes.artImage}
          />
        </div>

        <p className={classes.eyebrow}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
          </svg>
          Custom builds
        </p>

        <h2 id="deals-heading" className={classes.heading}>
          Custom gaming PCs, built around your budget
        </h2>

        <p className={classes.copy}>
          Not sold off a shelf — tell us what you play and what you want to spend, and we spec a
          build against it from parts we stock, assembled and tested in-store before you collect
          it.
        </p>

        <span className={classes.specsLabel}>What&rsquo;s included</span>

        <ul className={classes.specs}>
          {SPECS.map(spec => (
            <li key={spec} className={classes.spec}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {spec}
            </li>
          ))}
        </ul>

        <div className={classes.actions}>
          <Link href="/products/custom-gaming-pc-ryzen-5-rtx" className={classes.cta}>
            See the starting build
          </Link>
          <Link href={WHATSAPP_QUOTE_HREF} className={classes.ctaGhost}>
            WhatsApp us your budget
          </Link>
        </div>
      </div>
    </Gutter>
  </section>
)
