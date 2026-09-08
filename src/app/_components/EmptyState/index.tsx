// src/app/_components/EmptyState/index.tsx
//
// The one place an empty or failed result is rendered.
//
// Every empty state in the storefront and the admin goes through this so
// they cannot drift into three different tones of voice. Each one says what
// happened and offers exactly one way forward — an empty state with no next
// step is a dead end.
//
// `tone="error"` is for "something went wrong", which reads differently
// from "there is nothing here yet" and is announced assertively rather than
// politely.

import React from 'react'
import Link from 'next/link'

import classes from './index.module.scss'

export interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

export interface EmptyStateProps {
  title: string
  description?: string
  action?: EmptyStateAction
  tone?: 'neutral' | 'error'
  /** Optional inline icon. Defaults to a neutral glyph appropriate to the tone. */
  icon?: React.ReactNode
  className?: string
}

const NeutralIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="m4 7.5 8 4.5 8-4.5M12 12v9" stroke="currentColor" strokeWidth="1.6" />
  </svg>
)

const ErrorIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16.25" r="1" fill="currentColor" />
  </svg>
)

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  tone = 'neutral',
  icon,
  className,
}) => (
  <div
    className={[classes.emptyState, tone === 'error' && classes.error, className]
      .filter(Boolean)
      .join(' ')}
    role={tone === 'error' ? 'alert' : 'status'}
  >
    <span className={classes.icon}>{icon ?? (tone === 'error' ? ErrorIcon : NeutralIcon)}</span>

    <h3 className={classes.title}>{title}</h3>
    {description && <p className={classes.description}>{description}</p>}

    {action &&
      (action.href ? (
        <Link href={action.href} className={classes.action}>
          {action.label}
        </Link>
      ) : (
        <button type="button" className={classes.action} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
  </div>
)
