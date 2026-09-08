'use client'

// src/app/(pages)/checkout/PaynowCheckoutButton/index.tsx
//
// The customer-facing entry point into the Paynow flow.
//
// This component never computes, displays or submits a price of its own.
// Clicking "Pay with Paynow" sends a POST with no body to
// /api/checkout/paynow/initiate; that route derives the cart, the prices
// and the total server-side and returns a `redirectUrl` to navigate to.
// There is nothing here for a tampered client to influence.

import React, { useState } from 'react'

import { Message } from '../../../_components/Message'

import classes from './index.module.scss'

interface InitiateResponse {
  redirectUrl?: string
  error?: string
}

export const PaynowCheckoutButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async (): Promise<void> => {
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/checkout/paynow/initiate', {
        method: 'POST',
        credentials: 'include',
      })

      const data: InitiateResponse | null = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Unable to start Paynow checkout. Please try again.')
      }

      if (!data?.redirectUrl) {
        throw new Error('Paynow did not return a payment link. Please try again.')
      }

      // Paynow's hosted payment page is an external origin, so a plain
      // location change is correct here rather than the in-app router.
      window.location.href = data.redirectUrl
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setIsLoading(false)
    }
  }

  return (
    <div className={classes.paynow}>
      {error && <Message error={error} />}

      {/* One control, full width, and the only primary action on the page:
          the reassurance copy and the "back to cart" escape hatch live in
          the panel around this, so they are not competing with it. */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className={classes.payButton}
        // Announced to a screen reader while the redirect is being set up,
        // which is otherwise a silent second or two.
        aria-busy={isLoading}
      >
        {isLoading ? (
          <React.Fragment>
            <span className={classes.spinner} aria-hidden="true" />
            Redirecting to Paynow…
          </React.Fragment>
        ) : (
          <React.Fragment>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3l7 3v5.5c0 4.2-2.9 8.1-7 9.5-4.1-1.4-7-5.3-7-9.5V6z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            Pay securely with Paynow
          </React.Fragment>
        )}
      </button>
    </div>
  )
}

export default PaynowCheckoutButton
