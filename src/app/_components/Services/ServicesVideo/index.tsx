// src/app/_components/Services/ServicesVideo/index.tsx
//
// A short animated clip Terro Technology already uses to promote its
// service list, embedded at the foot of the Services page.
//
// Why this clip and not the "Deals of the month" slot it was first
// considered for: sampling its frames during the asset audit showed it is
// a services-overview reel — Networking, Programming, CCTV Installation,
// Sales & Accessories, Cellphones, then a contact card — not deal- or
// discount-specific content, and its subject matches this page exactly.
//
// Click-to-play, not autoplay-muted-loop: ffprobe shows a 39.5s AAC audio
// track, so this is narrated content, not a silent looping background —
// autoplaying it muted would either defeat the point (silent) or play
// audio the visitor never asked for. A native `<video controls>` element is
// used rather than a custom play button so play/pause stays keyboard- and
// screen-reader-operable without extra script, and a poster frame (sampled
// from the clip itself) is shown until the visitor presses play.
//
// No caption track: the clip's own on-screen text already names each
// service as it appears — confirmed by sampling its frames, not assumed —
// but the spoken audio has not been transcribed, and this project has no
// reliable way to produce an accurate transcript without inventing one
// (see docs/terro-technology-setup.md for what real captions would need).
// The paragraph below describes what the video visibly shows; it is not a
// transcript of what it says, and should not be read as one.
//
// Server component: native video controls need no client-side script.

import React from 'react'

import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

export const ServicesVideo: React.FC = () => (
  <section className={classes.section} aria-labelledby="services-video-heading">
    <Gutter className={classes.wrap}>
      <div className={classes.copy}>
        <p className={classes.eyebrow}>Watch</p>
        <h2 id="services-video-heading" className={classes.heading}>
          See the service side of the shop
        </h2>
        <p className={classes.lede}>
          A short clip Terro Technology uses to introduce networking, programming, CCTV
          installation, sales &amp; accessories and cellphone work — the same services described
          above. It has sound; nothing plays until you press play.
        </p>
      </div>

      <div className={classes.player}>
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
    </Gutter>
  </section>
)
