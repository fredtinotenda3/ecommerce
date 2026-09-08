import React, { forwardRef, Ref } from 'react'

import classes from './index.module.scss'

type Props = {
  left?: boolean
  right?: boolean
  /** Widens the content column for full-bleed-ish sections such as the
   * homepage hero and product grids. */
  wide?: boolean
  className?: string
  children: React.ReactNode
  ref?: Ref<HTMLDivElement>
}

export const Gutter: React.FC<Props> = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { left = true, right = true, wide = false, className, children } = props

  return (
    <div
      ref={ref}
      className={[
        classes.gutter,
        wide && classes.wide,
        left && classes.gutterLeft,
        right && classes.gutterRight,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
})

Gutter.displayName = 'Gutter'
