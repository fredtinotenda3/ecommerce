'use client'

import React, { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'

import { useAuth } from '../../../_providers/Auth'
import { StorefrontSettingsLike } from '../../../_types/storefront'

export const LogoutPage: React.FC<{
  // PHASE 13F-B: narrowed from the full `payload-types.ts` `Settings` —
  // see CartPage/index.tsx's identical comment (and
  // StorefrontSettingsLike's doc comment in src/app/_types/storefront.ts).
  settings: StorefrontSettingsLike
}> = props => {
  const { settings } = props
  const { productsPage } = settings || {}
  const { logout } = useAuth()
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const performLogout = async () => {
      try {
        await logout()
        setSuccess('Logged out successfully.')
      } catch (_) {
        setError('You are already logged out.')
      }
    }

    performLogout()
  }, [logout])

  return (
    <Fragment>
      {(error || success) && (
        <div>
          <h1>{error || success}</h1>
          <p>
            {'What would you like to do next?'}
            {typeof productsPage === 'object' && productsPage?.slug && (
              <Fragment>
                {' '}
                <Link href={`/${productsPage.slug}`}>Click here</Link>
                {` to shop.`}
              </Fragment>
            )}
            {` To log back in, `}
            <Link href="/login">click here</Link>
            {'.'}
          </p>
        </div>
      )}
    </Fragment>
  )
}
