// src/app/_components/Logo/index.tsx
//
// The Tech Haven lockup: a mark plus the supplied wordmark.
//
// The mark is inline SVG rather than a file so it inherits `currentColor`
// and works on any surface without shipping two assets.
//
// The wordmark is the supplied brand asset and exists only as two fixed
// files, one black and one white. `variant` picks between them for surfaces
// whose colour is fixed regardless of theme (the footer is always dark, so
// it always wants the white mark).
//
// `variant="auto"` — the header's case — is the interesting one. The surface
// behind it flips with the theme, and the active theme is only known in the
// browser, so choosing the file in JavaScript would mean either rendering
// the wrong one on the server (a visible flash, plus a hydration mismatch)
// or rendering nothing until mount (a hole in the header on first paint).
// Instead BOTH files are rendered and CSS reveals the right one. It costs
// one extra request for a ~1KB SVG and is correct at first paint in either
// theme — which is what the previous version got wrong: the header always
// used the black wordmark, so in dark mode the brand name was invisible.

import React from 'react'
import Image from 'next/image'

import classes from './index.module.scss'

export const LogoMark: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className,
}) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="32" height="32" rx="9" fill="currentColor" />
    <path
      d="M9 21.5V11.5C9 10.6716 9.67157 10 10.5 10H14.5C17.5376 10 20 12.4624 20 15.5C20 18.5376 17.5376 21 14.5 21H13"
      stroke="var(--th-logo-mark-ink, #fff)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="21.5" cy="21.5" r="2.5" fill="var(--th-logo-mark-accent, #fcd34d)" />
  </svg>
)

export const Logo: React.FC<{
  /**
   * `light` — dark wordmark, for a surface that is always light.
   * `dark`  — white wordmark, for a surface that is always dark.
   * `auto`  — follows the active theme. Use anywhere the surface behind the
   *           logo changes with the theme, such as the header.
   */
  variant?: 'light' | 'dark' | 'auto'
  className?: string
  /** The header logo is above the fold; everything else is not. */
  priority?: boolean
}> = ({ variant = 'light', className, priority = false }) => {
  const showBoth = variant === 'auto'

  return (
    <span className={[classes.logo, classes[variant], className].filter(Boolean).join(' ')}>
      <LogoMark className={classes.mark} />

      {(showBoth || variant === 'light') && (
        <Image
          src="/logo-black.svg"
          // Only one of the pair is ever visible, so only one carries the
          // accessible name; the other is decorative.
          alt={showBoth ? '' : 'Tech Haven'}
          aria-hidden={showBoth || undefined}
          width={150}
          height={25}
          className={[classes.wordmark, showBoth && classes.wordmarkLight]
            .filter(Boolean)
            .join(' ')}
          priority={priority}
        />
      )}

      {(showBoth || variant === 'dark') && (
        <Image
          src="/logo-white.svg"
          alt="Tech Haven"
          width={150}
          height={25}
          className={[classes.wordmark, showBoth && classes.wordmarkDark].filter(Boolean).join(' ')}
          priority={priority}
        />
      )}
    </span>
  )
}
