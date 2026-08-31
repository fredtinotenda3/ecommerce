'use client'

// src/app/_components/ErrorBoundary/index.tsx
//
// PHASE 13D — generic, minimal client-side error boundary.
//
// Added specifically so a render-phase crash inside HeaderComponent /
// FooterComponent (see the reproducible `usePathname` /
// "Cannot read properties of null (reading 'useContext')" crash documented
// in PHASE13C_REPORT.md) degrades to rendering nothing for that section
// instead of taking down the entire page. React error boundaries can only
// be class components (there is no Hook equivalent) and only catch errors
// thrown during rendering of their children, not inside the boundary's own
// hooks — so `usePathname` in HeaderComponent/FooterComponent must stay an
// unconditional, top-level hook call (react-hooks/rules-of-hooks); this
// boundary is the mechanism that makes that safe.
import React from 'react'

interface Props {
  children: React.ReactNode
  /** Rendered in place of `children` after a caught error. Defaults to
   * rendering nothing, which matches the existing `header = null` /
   * `footer = null` fallback behavior already used one level up in
   * src/app/_components/Header/index.tsx and
   * src/app/_components/Footer/index.tsx when the data fetch itself
   * fails. */
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }

    return this.props.children
  }
}

export default ErrorBoundary
