'use client'

// src/app/_components/ThemeToggle/index.tsx
//
// The light/dark control, as a real control.
//
// It replaces a bare `<select>` that sat unlabelled in the header and was,
// for practical purposes, undiscoverable — it looked like a form field that
// had wandered onto the page.
//
// Three states, not two: "System" is the default and must stay reachable,
// because a visitor who has set a preference at the OS level expects the
// site to follow it. A two-way toggle silently pins the choice the first
// time it is touched and there is then no way back.
//
// Two presentations of the same state, chosen by the `variant` prop:
//
//   - `icon` (header): one button that cycles System → Light → Dark. Compact
//     enough for a crowded action row, and its accessible name says what
//     the NEXT press will do, which is the only thing a screen-reader user
//     needs from a cycling control.
//   - `segmented` (mobile drawer): all three states visible as a radio
//     group, because there is room for it and an explicit choice is easier
//     than discovering a cycle.
//
// Nothing renders until after mount. The stored preference lives in
// localStorage, which the server cannot read, so rendering a state on the
// server would guarantee a hydration mismatch on every visit by anyone who
// has ever chosen a theme.

import React, { useCallback, useEffect, useState } from 'react'

import { useTheme } from '../../_providers/Theme'
import { themeLocalStorageKey } from '../../_providers/Theme/shared'
import type { Theme } from '../../_providers/Theme/types'
import { themeIsValid } from '../../_providers/Theme/types'

import classes from './index.module.scss'

/** `null` means "follow the system". */
type Choice = Theme | null

const ORDER: Choice[] = [null, 'light', 'dark']

const LABELS: { value: Choice; label: string; description: string }[] = [
  { value: null, label: 'System', description: 'Match my device' },
  { value: 'light', label: 'Light', description: 'Always light' },
  { value: 'dark', label: 'Dark', description: 'Always dark' },
]

const SystemIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="4" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M9 21h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const SunIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M12 2.8v2.1M12 19.1v2.1M4.5 4.5l1.5 1.5M18 18l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.5 19.5 6 18M18 6l1.5-1.5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
)

const MoonIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>
)

const iconFor = (choice: Choice): React.ReactNode => {
  if (choice === 'light') return SunIcon
  if (choice === 'dark') return MoonIcon
  return SystemIcon
}

const labelFor = (choice: Choice): string =>
  LABELS.find(entry => entry.value === choice)?.label ?? 'System'

export const ThemeToggle: React.FC<{
  variant?: 'icon' | 'segmented'
  className?: string
}> = ({ variant = 'icon', className }) => {
  const { setTheme } = useTheme()
  const [choice, setChoice] = useState<Choice>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(themeLocalStorageKey)
    } catch {
      // Private browsing, or storage blocked. "System" is the right
      // fallback, and the control still works for the session.
    }

    setChoice(themeIsValid(stored) ? stored : null)
    setIsMounted(true)
  }, [])

  const apply = useCallback(
    (next: Choice) => {
      setChoice(next)
      setTheme(next)
    },
    [setTheme],
  )

  const cycle = useCallback(() => {
    const index = ORDER.findIndex(entry => entry === choice)
    apply(ORDER[(index + 1) % ORDER.length])
  }, [apply, choice])

  // Reserve the space before mount so the header's action row does not
  // reflow when the control appears.
  if (!isMounted) {
    return <span className={[classes.placeholder, className].filter(Boolean).join(' ')} aria-hidden="true" />
  }

  if (variant === 'segmented') {
    return (
      <div
        className={[classes.segmented, className].filter(Boolean).join(' ')}
        role="radiogroup"
        aria-label="Colour theme"
      >
        {LABELS.map(entry => {
          const isSelected = entry.value === choice

          return (
            <button
              key={entry.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={[classes.segment, isSelected && classes.segmentActive]
                .filter(Boolean)
                .join(' ')}
              onClick={() => apply(entry.value)}
            >
              {iconFor(entry.value)}
              {entry.label}
            </button>
          )
        })}
      </div>
    )
  }

  const nextChoice = ORDER[(ORDER.findIndex(entry => entry === choice) + 1) % ORDER.length]

  return (
    <button
      type="button"
      className={[classes.iconButton, className].filter(Boolean).join(' ')}
      onClick={cycle}
      // Says what pressing it does, not merely what it currently is — the
      // difference between a control a screen-reader user can operate and
      // one they have to experiment with.
      aria-label={`Colour theme: ${labelFor(choice)}. Switch to ${labelFor(nextChoice)}.`}
      title={`Theme: ${labelFor(choice)}`}
    >
      <span className={classes.iconSwap} key={labelFor(choice)}>
        {iconFor(choice)}
      </span>
    </button>
  )
}
