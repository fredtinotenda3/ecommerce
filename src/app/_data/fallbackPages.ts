// src/app/_data/fallbackPages.ts
//
// Content rendered when the database has no `home` or `cart` page yet.
//
// This exists so a freshly provisioned deployment shows something coherent
// instead of a 404 while the catalogue is still being set up. It is a
// rendering fallback only — nothing here is written to the database, and a
// real page with the same slug always takes precedence.

import type { StorefrontPage } from '../_types/storefront'

const now = new Date(0).toISOString()

export const fallbackHome: StorefrontPage = {
  id: 'fallback-home',
  title: 'Home',
  slug: 'home',
  _status: 'published',
  createdAt: now,
  updatedAt: now,
  meta: {
    title: 'Store',
    description: 'An online store built with Next.js, MongoDB and Paynow.',
  },
  hero: {
    type: 'lowImpact',
    richText: [
      {
        type: 'h1',
        children: [{ text: 'Your store is ready' }],
      },
      {
        type: 'p',
        children: [
          {
            text: 'There is no home page in the database yet, so this placeholder is being shown. Sign in to the admin area at /admin to review products, orders and customers, then publish a page with the slug "home" to replace this.',
          },
        ],
      },
    ],
  },
  layout: [],
}

export const fallbackCart: StorefrontPage = {
  id: 'fallback-cart',
  title: 'Cart',
  slug: 'cart',
  _status: 'published',
  createdAt: now,
  updatedAt: now,
  meta: {
    title: 'Cart',
    description: 'Your cart syncs to your account so you can continue shopping on any device.',
  },
  hero: {
    type: 'lowImpact',
    richText: [
      {
        type: 'h1',
        children: [{ text: 'Cart' }],
      },
      {
        type: 'p',
        children: [
          {
            text: 'Items are kept in this browser until you sign in, after which your cart follows your account across devices.',
          },
        ],
      },
    ],
  },
  layout: [],
}
