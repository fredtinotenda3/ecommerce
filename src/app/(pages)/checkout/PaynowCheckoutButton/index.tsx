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

import { Button } from '../../../_components/Button'
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
      <h3 className={classes.heading}>Payment Details</h3>
      {error && <Message error={error} />}
      <p className={classes.description}>
        {"You'll be redirected to Paynow to complete your payment securely."}
      </p>
      <div className={classes.actions}>
        <Button label="Back to cart" href="/cart" appearance="secondary" disabled={isLoading} />
        <Button
          label={isLoading ? 'Redirecting…' : 'Pay with Paynow'}
          onClick={handleClick}
          appearance="primary"
          disabled={isLoading}
        />
      </div>
    </div>
  )
}

export default PaynowCheckoutButton
