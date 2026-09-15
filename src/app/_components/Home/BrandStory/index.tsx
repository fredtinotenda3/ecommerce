// src/app/_components/Home/BrandStory/index.tsx
//
// The homepage's "what we actually do" section — the same real Terro
// Technology clip already used on the Services page
// (`/media/terro-story.mp4`, see ServicesVideo's own header comment for the
// full asset-audit reasoning), given its own premium placement on the
// homepage instead of being left isolated on a page a visitor may never
// reach. This is not a second video: it is the same supplied asset, used a
// second time because it genuinely supports two different pages — a
// homepage visitor sees the shop in motion right after the "why us" band;
// a Services-page visitor sees the same reel as direct evidence for the
// service list on that page. Nothing about the video's content, captions
// state or accessibility treatment differs between the two placements.
//
// Composition: seeded after `ValueProps` and before `Testimonials` — the
// homepage's own argument order is brand → discovery → product → offer →
// why us → [this: watch the shop in motion] → proof → conversion. Showing
// the real counter and services after making the "why us" case, and before
// social proof, is a deliberate sequencing choice, not an arbitrary slot.
//
// Click-to-play, not autoplay-muted-loop — see ServicesVideo for why
// (39.5s AAC audio track; this is narrated content, not a silent loop).
//
// Server component: native video controls need no client-side script.

import React from 'react'

import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

export const BrandStory: React.FC = () => (
  <section className={classes.section} aria-labelledby="brand-story-heading">
    <Gutter className={classes.wrap}>
      <div className={classes.player}>
        <div className={classes.playerGlow} aria-hidden="true" />
        <video
          controls
          playsInline
          preload="metadata"
          poster="/media/terro-story-poster.jpg"
          className={classes.video}
        >
          <source src="/media/terro-story.mp4" type="video/mp4" />
          Your browser does not support embedded video. You can{' '}
          <a href="/media/terro-story.mp4">download the clip</a> instead.
        </video>
      </div>

      <div className={classes.copy}>
        <p className={classes.eyebrow}>What we do</p>
        <h2 id="brand-story-heading" className={classes.heading}>
          Sales and service, from the same counter
        </h2>
        <p className={classes.lede}>
          A short clip Terro Technology uses to introduce networking, programming, CCTV
          installation, sales &amp; accessories and cellphone work. It has sound; nothing plays
          until you press play.
        </p>
        <a href="/services" className={classes.link}>
          See the full service list
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h14m-6-6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </Gutter>
  </section>
)
