'use client'

import React from 'react'

import { AuthProvider } from './Auth'
import { CartProvider } from './Cart'
import { FilterProvider } from './Filter'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FilterProvider>
          <CartProvider>{children}</CartProvider>
        </FilterProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
