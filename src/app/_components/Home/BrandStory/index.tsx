// src/app/_components/Home/BrandStory/index.tsx
//
// The homepage's "what we actually do" section — by default the same real
// Terro Technology clip already used on the Services page
// (`/media/terro-story.mp4`, see ServicesVideo's own header comment for the
// full asset-audit reasoning), given its own premium placement on the
// homepage instead of being left isolated on a page a visitor may never
// reach.
//
// ADMIN-MANAGED CONTENT. The copy, the link and the clip itself (video +
// poster) are all optionally driven by the `home` Home-global record — see
// `Home/Hero`'s header comment for the shared fallback contract (each
// field falls back to its own default independently; a fresh install with
// no `home` document renders exactly this file's hardcoded defaults). A
// newly uploaded video is served through the media system's own
// `mimeType`, so an operator can swap in an mp4 or webm clip without a
// code change (see src/lib/media/storage.ts's `ALLOWED_MIME_TYPES`).
//
// KNOWN LIMITATION — aspect ratio. This project's media pipeline reads
// pixel dimensions from an image's header bytes (imageDimensions.ts) but
// has no equivalent parser for video containers, so an uploaded video's
// `width`/`height` are unlikely to be known. Rather than guess wrong and
// silently distort a differently-shaped clip, `.video` below keeps the
// current clip's real aspect ratio (452:640, a portrait recording) as its
// box and adds `object-fit: cover` so a future clip with a different
// native shape crops to fill that box instead of stretching. A landscape
// replacement clip would still be well served by adding an MP4/WebM
// `moov`/`tkhd` dimension reader alongside `imageDimensions.ts` and driving
// `.video`'s aspect-ratio from it — flagged here rather than attempted as
// a side effect of this change, since a binary container parser deserves
// its own review and test coverage.
//
// Click-to-play, not autoplay-muted-loop — see ServicesVideo for why
// (narrated content, not a silent loop).
//
// Server component: native video controls need no client-side script.

import React from 'react'

import type { StorefrontHome } from '../../../_types/storefront'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

const DEFAULT_VIDEO = {
  url: '/media/terro-story.mp4',
  poster: '/media/terro-story-poster.jpg',
  mimeType: 'video/mp4',
}

export interface BrandStoryProps {
  home?: StorefrontHome | null
}

export const BrandStory: React.FC<BrandStoryProps> = ({ home }) => {
  const eyebrow = home?.videoEyebrow || 'What we do'
  const heading = home?.videoHeading || 'Sales and service, from the same counter'
  const lede =
    home?.videoLede ||
    'A short clip Terro Technology uses to introduce networking, programming, CCTV installation, sales & accessories and cellphone work. It has sound; nothing plays until you press play.'
  const linkLabel = home?.videoLinkLabel || 'See the full service list'
  // Both label AND href are required before either overrides its default —
  // see the matching comment in Home/Hero for why the href is not derived
  // from the label's presence alone.
  const linkHref = home?.videoLinkLabel && home?.videoLinkHref ? home.videoLinkHref : '/services'

  const videoUrl = home?.video?.url || DEFAULT_VIDEO.url
  const videoMimeType = home?.video?.mimeType || DEFAULT_VIDEO.mimeType
  const posterUrl = home?.videoPoster?.url || DEFAULT_VIDEO.poster

  return (
    <section className={classes.section} aria-labelledby="brand-story-heading">
      <Gutter className={classes.wrap}>
        <div className={classes.player}>
          <div className={classes.playerGlow} aria-hidden="true" />
          <video
            controls
            playsInline
            preload="metadata"
            poster={posterUrl}
            className={classes.video}
          >
            <source src={videoUrl} type={videoMimeType} />
            Your browser does not support embedded video. You can{' '}
            <a href={videoUrl}>download the clip</a> instead.
          </video>
        </div>

        <div className={classes.copy}>
          <p className={classes.eyebrow}>{eyebrow}</p>
          <h2 id="brand-story-heading" className={classes.heading}>
            {heading}
          </h2>
          <p className={classes.lede}>{lede}</p>
          <a href={linkHref} className={classes.link}>
            {linkLabel}
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
}
