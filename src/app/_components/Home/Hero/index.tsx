// src/app/_components/Home/Hero/index.tsx
//
// The homepage hero.
//
// Composition: a single two-column band where the product photograph IS the
// right-hand column, not a decorative strip beneath the copy. The image is a
// transparent cutout, so it composites onto the band's own gradient in both
// themes — which is what lets it sit in the layout rather than in a white
// card floating on top of it.
//
// The previous version had two problems worth naming, because they are the
// ones most likely to come back:
//
//   1. The image lived in a rounded, shadowed container. A cutout on a
//      transparent background inside a white card reads as a screenshot of
//      a product page, not as photography.
//   2. A second image was pinned to the corner purely as decoration. It was
//      a gaming PC — off-brand for a shop whose entire catalogue is Apple —
//      and it competed with the subject for attention. It is gone; see the
//      report for why that asset is not used anywhere.
//
// The asset itself is `hero-apple.png`, prepared from the supplied
// `hero-1.png`: the original had ANOTHER RETAILER'S WORDMARK ("BESTSTORE")
// baked into it as semi-transparent type behind the products. It was
// invisible against a white page and appeared the moment the hero gained a
// tinted background. Shipping a competitor's branding on your own homepage
// is not a styling detail, so the wordmark was removed and the frame
// cropped to the subject. The original file is left in place, unused.
//
// Server component: no state, no interactivity. The homepage is the page
// most likely to be a visitor's first, and it should not wait on a bundle
// to render its first screen.

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

/** The trust line under the buttons. Three short claims, not four — the
 * fourth always turns the row into two lines on a phone. */
const PROOF = ['Two-year warranty', 'Free delivery over $150', 'Pay with EcoCash or card']

export const HomeHero: React.FC = () => (
  <section className={classes.hero} aria-labelledby="home-hero-heading">
    {/* Decorative wash, drawn behind everything and marked hidden: it
        carries no information and should not be announced. */}
    <div className={classes.wash} aria-hidden="true" />

    <Gutter className={classes.wrap}>
      <div className={classes.copy}>
        <p className={classes.eyebrow}>
          <span className={classes.eyebrowDot} aria-hidden="true" />
          Authorised Apple stock, in Harare
        </p>

        <h1 id="home-hero-heading" className={classes.heading}>
          The Apple range,
          <span className={classes.headingAccent}> without the guesswork.</span>
        </h1>

        <p className={classes.lede}>
          Sealed stock and a two-year warranty on every device — from people who will tell you
          when the cheaper model is the right one.
        </p>

        <div className={classes.actions}>
          <Link href="/products" className={classes.primaryCta}>
            Shop the range
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14m-6-6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <Link href="/products?category=laptops" className={classes.secondaryCta}>
            Browse MacBooks
          </Link>
        </div>

        <ul className={classes.proof}>
          {PROOF.map(claim => (
            <li key={claim}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {claim}
            </li>
          ))}
        </ul>
      </div>

      <div className={classes.art}>
        {/* A soft radial pool behind the products, so a cutout with no
            ground shadow still feels seated rather than pasted on. */}
        <div className={classes.artGlow} aria-hidden="true" />

        <Image
          src="/brand/hero-apple.png"
          alt="An iPhone 15 Pro standing in front of an open MacBook"
          width={789}
          height={669}
          // The largest-contentful-paint element on the page: fetched at
          // high priority and never lazy-loaded.
          priority
          fetchPriority="high"
          quality={90}
          sizes="(max-width: 1024px) 86vw, 46vw"
          className={classes.artImage}
        />
      </div>
    </Gutter>
  </section>
)
