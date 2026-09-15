// src/app/_components/Home/Hero/index.tsx
//
// The homepage hero.
//
// VISUAL DOMINANCE, HONESTLY ACHIEVED — read this before changing `.art`.
//
// The one real product photograph here (`/brand/hero-phones.png`) is
// genuinely small: 460×280, cropped from the client's own "Boxed
// Smartphones" flyer with every price and headline removed (see
// docs/image-polish-prompts.md). Stretching that source past roughly its
// own pixel density starts to look soft — so the crisp photograph itself is
// NOT blown up to fill 60–70% of the hero. What changed instead is the
// STAGE around it: a blurred, larger "echo" of the same photograph sits
// behind the sharp one (depth, not a second real asset), a bespoke
// technology-panel SVG (see index.module.scss and public/brand/tech-panel-
// hero-*.svg) frames it with diagonal circuitry and glow, and the grid
// itself now gives the art column roughly two-thirds of the row on desktop.
// The result is a large, confident visual moment built from composition —
// scale, glow, layered depth, negative space — rather than from upscaling a
// 460px source past what it can carry. If Terro can supply a genuinely
// higher-resolution product photograph later, the crisp <Image> below is
// the only element that needs a bigger source; nothing else in this
// composition depends on that photo's native resolution.
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

    {/* The client's reference artwork (an actual raster crop, see the
        module's stylesheet) plus the scrim that keeps it off the copy
        column. Both are decorative only. */}
    <div className={classes.circuit} aria-hidden="true" />
    <div className={classes.circuitScrim} aria-hidden="true" />

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
        {/* The technology-panel accent local to the art stage: a tighter,
            higher-opacity crop than the full-band `.circuit` layer above,
            so the product visibly sits "in front of" its own energy field
            rather than just having a backdrop somewhere behind the band. */}
        <div className={classes.stagePanel} aria-hidden="true" />

        {/* A soft radial pool behind the phones, echoing the glow the
            photo's own light-blue background already carries. */}
        <div className={classes.artGlow} aria-hidden="true" />

        {/* A blurred, larger duplicate of the same real photograph — not a
            second asset, not an upscale presented as sharp — purely a
            depth/scale cue sitting behind the crisp image so the product
            reads as large without the crisp pixels themselves being
            stretched past what a 460×280 source can carry. Decorative:
            the crisp <Image> below carries the real alt text. */}
        <Image
          src="/brand/hero-phones.png"
          alt=""
          aria-hidden="true"
          width={460}
          height={280}
          quality={80}
          className={classes.artEcho}
        />

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
          sizes="(max-width: 1024px) 84vw, 44vw"
          className={classes.artImage}
        />
      </div>
    </Gutter>
  </section>
)
