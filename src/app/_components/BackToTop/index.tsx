'use client'

// src/app/_components/BackToTop/index.tsx
//
// A back-to-top control, shown once the visitor is far enough down a page
// for it to be useful.
//
// Long product grids are the reason this exists: paging to the bottom of
// twelve products and then wanting the filters again is otherwise a long
// scroll on a phone.
//
// A real `<button>`, so it is keyboard reachable and announced correctly.
// It is removed from the DOM rather than hidden when not needed, so it
// never becomes an invisible tab stop. The scroll listener is passive and
// throttled to one animation frame — a listener that runs on every scroll
// event is a measurable jank source on low-end devices.

import React, { useCallback, useEffect, useState } from 'react'

import classes from './index.module.scss'

/** Roughly one and a half viewports: far enough that scrolling back is a
 * real chore, not so soon that the button hovers over the hero. */
const SHOW_AFTER_PX = 900

export const BackToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let frame = 0

    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        setIsVisible(window.scrollY > SHOW_AFTER_PX)
      })
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const scrollToTop = useCallback(() => {
    // Respect a reduced-motion preference: a full-page smooth scroll is
    // exactly the kind of movement that setting exists to suppress.
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' })

    // Move focus back to the top of the document as well, or a keyboard
    // user's tab position stays where the button was.
    const main = document.getElementById('main-content')
    if (main) {
      main.setAttribute('tabindex', '-1')
      main.focus({ preventScroll: true })
      main.removeAttribute('tabindex')
    }
  }, [])

  if (!isVisible) return null

  return (
    <button type="button" className={classes.button} onClick={scrollToTop} aria-label="Back to top">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 19V5m0 0-6 6m6-6 6 6"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
