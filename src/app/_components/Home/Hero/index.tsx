// src/app/_components/Home/Hero/index.tsx
//
// The homepage hero.
//
// VISUAL DOMINANCE, HONESTLY ACHIEVED — read this before changing `.art`.
//
// The default product photograph here (`/brand/hero-phones.png`) is
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
// 460px source past what it can carry.
//
// ADMIN-MANAGED CONTENT. Every piece of copy, both CTAs and the product
// photo are optionally driven by the `home` Home-global record (see
// `src/lib/domain/types.ts`'s `Home` interface and `/admin/globals`) —
// `page.tsx` fetches it and passes it down as `home`. Each field falls back
// to the values below independently, so an operator who has only set the
// heading does not lose the default photo, and a fresh install with no
// `home` document renders exactly the hardcoded design this file shipped
// with. When an operator supplies a higher-resolution or differently
// shaped photograph, `.artImage`'s `width: min(100%, 30rem); height: auto`
// (see the stylesheet) means the STAGE stays the same size and the new
// photo's own aspect ratio is respected — nothing here needs to change for
// that to work, which is exactly what lets section 23 of a design brief
// ("let the admin replace the hero media with a higher-quality asset")
// hold in practice, not just in principle.
//
// Server component: no state, no interactivity. The homepage is the page
// most likely to be a visitor's first, and it should not wait on a bundle
// to render its first screen.

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

import type { StorefrontHome } from '../../../_types/storefront'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

/** The trust line under the buttons. Three short claims, not four — the
 * fourth always turns the row into two lines on a phone. Each one is
 * something the supplied flyers actually show Terro doing — no delivery or
 * warranty promise is invented here. Used whenever `home.heroProofPoints`
 * is unset or empty. */
const DEFAULT_PROOF = ['Boxed & preloved stock', 'Repairs done in-store', 'Pay with EcoCash or card']

const DEFAULT_HERO_IMAGE = {
  url: '/brand/hero-phones.png',
  width: 460,
  height: 280,
  alt: 'A Huawei, a Samsung Galaxy Ultra and an iPhone standing side by side',
}

export interface HomeHeroProps {
  home?: StorefrontHome | null
}

export const HomeHero: React.FC<HomeHeroProps> = ({ home }) => {
  const eyebrow = home?.heroEyebrow || 'Smartphones & consumer tech, in Harare'
  const heading = home?.heroHeading || 'Smartphones and tech,'
  const headingAccent = home?.heroHeadingAccent || 'sorted properly.'
  const lede =
    home?.heroLede ||
    'Boxed and preloved phones, laptops, gaming builds and the parts that keep them running — sold and repaired from the same counter.'
  const proof = home?.heroProofPoints?.length ? home.heroProofPoints : DEFAULT_PROOF

  // A CTA is validated server-side to be either fully set or fully empty
  // (see `assertCtaComplete` in AdminContentService) — but this reads
  // straight from the database, so a record written before that validation
  // existed, or edited directly, is not trusted to uphold it: both label
  // AND href are required before either overrides its default, rather than
  // deriving one from the presence of the other.
  const primaryCtaLabel = home?.heroPrimaryCtaLabel || 'Shop the range'
  const primaryCtaHref =
    home?.heroPrimaryCtaLabel && home?.heroPrimaryCtaHref ? home.heroPrimaryCtaHref : '/products'
  const secondaryCtaLabel = home?.heroSecondaryCtaLabel || 'Browse smartphones'
  const secondaryCtaHref =
    home?.heroSecondaryCtaLabel && home?.heroSecondaryCtaHref
      ? home.heroSecondaryCtaHref
      : '/products?category=smartphones'

  // Dimensions are only trusted when both are present — an AVIF upload (the
  // one image format this project's header-only dimension reader does not
  // parse; see src/lib/media/imageDimensions.ts) would otherwise hand
  // next/image a `null`, and a missing width/height on a non-`fill` image
  // is a hard error, not a graceful default.
  const heroImage =
    home?.heroImage?.url && home.heroImage.width && home.heroImage.height
      ? {
          url: home.heroImage.url,
          width: home.heroImage.width,
          height: home.heroImage.height,
          alt: home.heroImage.alt || DEFAULT_HERO_IMAGE.alt,
        }
      : DEFAULT_HERO_IMAGE

  return (
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
            {eyebrow}
          </p>

          <h1 id="home-hero-heading" className={classes.heading}>
            {heading}
            <span className={classes.headingAccent}> {headingAccent}</span>
          </h1>

          <p className={classes.lede}>{lede}</p>

          <div className={classes.actions}>
            <Link href={primaryCtaHref} className={classes.primaryCta}>
              {primaryCtaLabel}
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

            <Link href={secondaryCtaHref} className={classes.secondaryCta}>
              {secondaryCtaLabel}
            </Link>
          </div>

          <ul className={classes.proof}>
            {proof.map(claim => (
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

          {/* A blurred, larger duplicate of the same photograph — not a
              second asset, not an upscale presented as sharp — purely a
              depth/scale cue sitting behind the crisp image so the product
              reads as large without the crisp pixels themselves being
              stretched past what the source can carry. Decorative: the
              crisp <Image> below carries the real alt text. */}
          <Image
            src={heroImage.url}
            alt=""
            aria-hidden="true"
            width={heroImage.width}
            height={heroImage.height}
            quality={80}
            className={classes.artEcho}
          />

          <Image
            src={heroImage.url}
            alt={heroImage.alt}
            width={heroImage.width}
            height={heroImage.height}
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
}
