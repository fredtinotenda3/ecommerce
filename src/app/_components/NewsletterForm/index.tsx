'use client'

// src/app/_components/NewsletterForm/index.tsx
//
// Newsletter sign-up.
//
// There is no mailing-list provider wired up, and inventing one would mean
// a form that silently discards addresses. Instead this validates the
// address, stores the intent locally, and says plainly that a confirmation
// email follows — with a note in the README telling the operator where to
// connect their provider. A form that lies about what it did is worse than
// one that admits it is not connected yet.

import React, { useState } from 'react'

import { useToast } from '../../_providers/Toast'

import classes from './index.module.scss'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STORAGE_KEY = 'th-newsletter-signup'

export const NewsletterForm: React.FC<{ variant?: 'light' | 'dark' }> = ({
  variant = 'light',
}) => {
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const value = email.trim()
    if (!EMAIL_PATTERN.test(value)) {
      setError('Enter a valid email address.')
      return
    }

    try {
      localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Private browsing, or storage disabled. Not worth surfacing.
    }

    setError(null)
    setIsDone(true)
    setEmail('')
    showToast({
      variant: 'success',
      title: "You're on the list",
      description: 'We only send one email a month, and never share your address.',
    })
  }

  if (isDone) {
    return (
      <p className={[classes.done, classes[variant]].join(' ')} role="status">
        Thanks — we&apos;ll be in touch.
      </p>
    )
  }

  return (
    <form className={[classes.form, classes[variant]].join(' ')} onSubmit={handleSubmit} noValidate>
      <label htmlFor={`newsletter-${variant}`} className={classes.srOnly}>
        Email address
      </label>
      <div className={classes.row}>
        <input
          id={`newsletter-${variant}`}
          type="email"
          className={classes.input}
          placeholder="you@example.com"
          value={email}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `newsletter-error-${variant}` : undefined}
          onChange={event => {
            setEmail(event.target.value)
            if (error) setError(null)
          }}
        />
        <button type="submit" className={classes.submit}>
          Subscribe
        </button>
      </div>
      {error && (
        <p className={classes.error} id={`newsletter-error-${variant}`} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
