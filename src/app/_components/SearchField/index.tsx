'use client'

// src/app/_components/SearchField/index.tsx
//
// Product search in the header.
//
// Submits to /products?q=… rather than filtering client-side, so a search
// is a real URL: shareable, bookmarkable, and back-button friendly. The
// products page owns the matching itself.

import React, { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import classes from './index.module.scss'

export const SearchField: React.FC<{ className?: string; autoFocus?: boolean }> = ({
  className,
  autoFocus,
}) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = value.trim()
    router.push(query ? `/products?q=${encodeURIComponent(query)}` : '/products')
  }

  return (
    <form
      role="search"
      className={[classes.form, className].filter(Boolean).join(' ')}
      onSubmit={handleSubmit}
    >
      <label htmlFor="site-search" className={classes.srOnly}>
        Search products
      </label>
      <svg
        className={classes.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16.5 16.5 3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        id="site-search"
        type="search"
        className={classes.input}
        placeholder="Search products"
        value={value}
        autoFocus={autoFocus}
        onChange={event => setValue(event.target.value)}
      />
    </form>
  )
}
