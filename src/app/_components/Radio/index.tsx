import React from 'react'

import classes from './index.module.scss'

interface RadioButtonProps {
  label: string
  value: string
  isSelected: boolean
  onRadioChange: (value: string) => void
  groupName: string
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  value,
  isSelected,
  onRadioChange,
  groupName,
}) => (
  <label
    className={[classes.radioWrapper, isSelected && classes.selected].filter(Boolean).join(' ')}
  >
    <input
      type="radio"
      checked={isSelected}
      onChange={() => onRadioChange(value)}
      className={classes.radio}
      name={groupName}
      value={value}
    />
    <span className={classes.dot} aria-hidden="true" />
    <span>{label}</span>
  </label>
)
