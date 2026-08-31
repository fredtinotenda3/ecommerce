'use client'

import React from 'react'

import { AuthProvider } from '../_providers/Auth'
import { CartProvider } from '../_providers/Cart'
import { FilterProvider } from './Filter'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
  /** PHASE 13B: resolved server-side (see layout.tsx's `resolveAuthMode()`
   * call) and threaded through to `AuthProvider`, since `Providers`
   * itself is a client component and the underlying flag is not
   * `NEXT_PUBLIC_`-prefixed. Defaults to false, matching `AuthProvider`'s
   * own default, so omitting this prop preserves prior behavior. */
  nativeAuthEnabled?: boolean
}> = ({ children, nativeAuthEnabled = false }) => {
  return (
    <ThemeProvider>
      <AuthProvider nativeAuthEnabled={nativeAuthEnabled}>
        <FilterProvider>
          <CartProvider>{children}</CartProvider>
        </FilterProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
