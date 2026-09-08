// src/app/_components/Logo/index.tsx
//
// The Tech Haven lockup: a mark plus the supplied wordmark.
//
// The mark is inline SVG rather than a file so it inherits `currentColor`
// and works on both the light header and the dark footer without shipping
// two assets. The wordmark stays an image because it is the supplied
// brand asset.

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
  /** `dark` renders the white wordmark, for use on dark surfaces. */
  variant?: 'light' | 'dark'
  className?: string
}> = ({ variant = 'light', className }) => (
  <span className={[classes.logo, classes[variant], className].filter(Boolean).join(' ')}>
    <LogoMark className={classes.mark} />
    <Image
      src={variant === 'dark' ? '/logo-white.svg' : '/logo-black.svg'}
      alt="Tech Haven"
      width={150}
      height={25}
      className={classes.wordmark}
      priority
    />
  </span>
)
