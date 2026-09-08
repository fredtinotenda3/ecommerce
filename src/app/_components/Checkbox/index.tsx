import React, { ChangeEvent } from 'react'

import classes from './index.module.scss'

interface CheckboxProps {
  label: string
  value: string
  isSelected: boolean
  onClickHandler: (value: string) => void
  /** Optional count shown to the right, e.g. the number of matching products. */
  count?: number
}

/**
 * A controlled checkbox.
 *
 * It previously mirrored `isSelected` into local state on first render and
 * never looked at the prop again, which meant the box only ever reflected
 * what the user had clicked in this component. Anything that changed the
 * filter from outside — a `?category=` link, the back button, a "clear
 * filters" action — left the box showing the wrong state while the grid
 * showed the right one. The prop is now the single source of truth.
 */
export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  value,
  isSelected,
  onClickHandler,
  count,
}) => {
  const handleChange = (_event: ChangeEvent<HTMLInputElement>) => {
    onClickHandler(value)
  }

  return (
    <label className={[classes.checkboxWrapper, isSelected && classes.selected]
      .filter(Boolean)
      .join(' ')}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={handleChange}
        className={classes.checkbox}
      />
      <span className={classes.box} aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={classes.label}>{label}</span>
      {typeof count === 'number' && <span className={classes.count}>{count}</span>}
    </label>
  )
}
