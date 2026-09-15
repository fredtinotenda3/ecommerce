// src/app/_components/Home/Hero/index.tsx
//
// The homepage hero.
//
// Composition: a two-column band where the product photograph sits in the
// right-hand column, feathered at its edges into the band's own wash rather
// than boxed in a card. The asset is genuinely small — 460×280, cropped from
// the client's own "Boxed Smartphones" flyer with every price and headline
// removed (see docs/image-polish-prompts.md) — so the art column is
// deliberately capped near that width instead of stretched to fill a large
// column. Tech Haven's hero photograph was 789×669 and could carry a much
// bigger frame; this one cannot without upscaling a source image that does
// not support it, which the brief explicitly rules out. The copy column
// takes the space the image gives up, which is the honest trade rather than
// a smaller "wow moment".
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
 * fourth always turns the row into two lines on a phone. Each one is
 * something the supplied flyers actually show Terro doing — no delivery or
 * warranty promise is invented here. */
const PROOF = ['Boxed & preloved stock', 'Repairs done in-store', 'Pay with EcoCash or card']

export const HomeHero: React.FC = () => (
  <section className={classes.hero} aria-labelledby="home-hero-heading">
    {/* Decorative wash, drawn behind everything and marked hidden: it
        carries no information and should not be announced. */}
    <div className={classes.wash} aria-hidden="true" />

    <Gutter className={classes.wrap}>
      <div className={classes.copy}>
        <p className={classes.eyebrow}>
          <span className={classes.eyebrowDot} aria-hidden="true" />
          Smartphones & consumer tech, in Harare
        </p>

        <h1 id="home-hero-heading" className={classes.heading}>
          Smartphones and tech,
          <span className={classes.headingAccent}> sorted properly.</span>
        </h1>

        <p className={classes.lede}>
          Boxed and preloved phones, laptops, gaming builds and the parts that keep them
          running — sold and repaired from the same counter.
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

          <Link href="/products?category=smartphones" className={classes.secondaryCta}>
            Browse smartphones
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
        {/* A soft radial pool behind the phones, echoing the glow the
            photo's own light-blue background already carries. */}
        <div className={classes.artGlow} aria-hidden="true" />

        <Image
          src="/brand/hero-phones.png"
          alt="A Huawei, a Samsung Galaxy Ultra and an iPhone standing side by side"
          width={460}
          height={280}
          // The largest-contentful-paint element on the page: fetched at
          // high priority and never lazy-loaded.
          priority
          fetchPriority="high"
          quality={92}
          sizes="(max-width: 1024px) 78vw, 32vw"
          className={classes.artImage}
        />
      </div>
    </Gutter>
  </section>
)
