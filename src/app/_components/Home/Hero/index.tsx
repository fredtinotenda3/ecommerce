// src/app/_components/Home/Hero/index.tsx
//
// The homepage hero: what the shop sells, why buy it here, and two ways in.
//
// Server component — there is no state and no interactivity, so shipping it
// as client JavaScript would be waste on the page most likely to be a
// visitor's first.
//
// The images are the supplied brand shots. The first is marked `priority`
// because it is the largest-contentful-paint element on the page; the
// second is deliberately not, and is hidden below the large breakpoint so a
// phone never downloads it.

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { INCLUSIONS, SITE_TAGLINE } from '../../../constants/brand'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

export const HomeHero: React.FC = () => (
  <section className={classes.hero} aria-labelledby="home-hero-heading">
    <Gutter className={classes.wrap}>
      <div className={classes.copy}>
        <p className={classes.eyebrow}>{SITE_TAGLINE}</p>

        <h1 id="home-hero-heading" className={classes.heading}>
          The Apple range, without the guesswork.
        </h1>

        <p className={classes.lede}>
          Sealed stock, a two-year warranty on every device, and staff who will tell you when the
          cheaper model is the right one. Free delivery anywhere in Zimbabwe on orders over $150.
        </p>

        <div className={classes.actions}>
          <Link href="/products" className={classes.primaryCta}>
            Shop the range
          </Link>
          <Link href="/products?category=laptops" className={classes.secondaryCta}>
            Browse laptops
          </Link>
        </div>

        <ul className={classes.proof}>
          {INCLUSIONS.slice(0, 3).map(inclusion => (
            <li key={inclusion.title}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {inclusion.title}
            </li>
          ))}
        </ul>
      </div>

      <div className={classes.art}>
        <div className={classes.artPrimary}>
          <Image
            src="/brand/hero-1.png"
            alt="A MacBook, iPhone and Apple Watch arranged on a desk"
            width={1499}
            height={704}
            priority
            sizes="(max-width: 1024px) 100vw, 55vw"
            className={classes.artImage}
          />
        </div>

        <div className={classes.artSecondary}>
          <Image
            src="/brand/hero-2.png"
            alt=""
            width={2760}
            height={1408}
            sizes="30vw"
            className={classes.artImage}
          />
        </div>
      </div>
    </Gutter>
  </section>
)
