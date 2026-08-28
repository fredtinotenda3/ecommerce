'use client'

// src/app/(pages)/checkout/PaynowCheckoutButton/index.tsx
//
// PHASE 9 — the customer-facing entry point into the Paynow flow built
// in Phase 8. Rendered by CheckoutPage in place of the Stripe Elements
// form when `paynowCheckoutEnabled` is true.
//
// This component never computes, displays, or submits a price/total of
// its own — the cart/subtotal shown above it (in CheckoutPage) is for
// display only, same as it already was for the Stripe flow. Clicking
// "Pay with Paynow" sends a plain POST with no body to
// /api/checkout/paynow/initiate; that route re-derives everything
// (cart contents, prices, total) server-side from the database (see
// PHASE_8_REPORT.md's "Server-Side Pricing Enforcement" section) and
// returns a `redirectUrl` this component simply navigates the browser
// to. There is nothing here for a tampered client to influence.

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/api/checkout/paynow/initiate`,
        {
          method: 'POST',
          credentials: 'include',
        },
      )

      const data: InitiateResponse | null = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Unable to start Paynow checkout. Please try again.')
      }

      if (!data?.redirectUrl) {
        throw new Error('Paynow did not return a payment link. Please try again.')
      }

      // Full browser navigation to Paynow's hosted payment page — this
      // is an external redirect, not an in-app route, so a plain
      // location change (rather than next/navigation's router) is
      // correct here, same as how the Stripe flow's confirmPayment
      // ultimately navigates the browser away for redirect-based
      // payment methods.
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
