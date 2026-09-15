// src/app/_components/Logo/index.tsx
//
// The Terro Technology lockup: the client's own shield mark plus a live
// text wordmark.
//
// Two things changed from the previous (Tech Haven) version of this file,
// both because Terro's actual brand assets are different in kind, not just
// in colour:
//
//   1. The mark is a real supplied asset (`public/brand/terro-icon.png`,
//      cropped and made transparent from the client's own logo artwork —
//      see docs/image-polish-prompts.md), not a generic abstract glyph. It
//      is already two-colour (red and blue) and reads correctly on both a
//      light and a dark surface without a second file, so unlike the old
//      mark it never needs to change with the theme.
//   2. The wordmark is live text set in the site's own typeface, not an
//      image. Terro's supplied wordmark file is a JPEG-sourced graphic that
//      would render soft at header size and could not adopt the theme's
//      text colour; real text is crisp at any size and its colour follows
//      `--th-ink`, so the header wordmark switches from ink to off-white
//      with the rest of the page automatically. The one surface that does
//      NOT follow the page theme is the footer, which is always dark
//      regardless of light/dark mode — `variant="dark"` forces light text
//      there rather than relying on the (possibly light-mode) theme token.
//
// `variant="auto"` (the header's case) sets no colour at all: it inherits
// `--th-ink`, which already flips with `data-theme` — there is nothing left
// for this component to coordinate.

import React from 'react'
import Image from 'next/image'

import classes from './index.module.scss'

export const LogoMark: React.FC<{ size?: number; className?: string; priority?: boolean }> = ({
  size = 30,
  className,
  priority = false,
}) => (
  <Image
    src="/brand/terro-icon.png"
    alt=""
    aria-hidden="true"
    width={434}
    height={459}
    priority={priority}
    className={[classes.mark, className].filter(Boolean).join(' ')}
    style={{ height: size, width: 'auto' }}
  />
)

export const Logo: React.FC<{
  /**
   * `light` — dark/ink text, for a surface that is always light.
   * `dark`  — off-white text, for a surface that is always dark (the footer).
   * `auto`  — inherits `--th-ink`, which already follows the active theme.
   */
  variant?: 'light' | 'dark' | 'auto'
  className?: string
  /** The header logo is above the fold; everything else is not. */
  priority?: boolean
  /** Hide the "Technology" line at very small sizes (e.g. a tight mobile
   * action row) while keeping "Terro" and the mark. */
  compact?: boolean
}> = ({ variant = 'light', className, priority = false, compact = false }) => (
  <span className={[classes.logo, classes[variant], className].filter(Boolean).join(' ')}>
    <LogoMark priority={priority} />
    <span className={classes.wordmark}>
      <span className={classes.wordmarkTerro}>Terro</span>
      <span className={compact ? classes.srOnly : classes.wordmarkTechnology}>Technology</span>
    </span>
  </span>
)
