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
    title: 'Tech Haven — Premium tech, honestly priced',
    description:
      'Genuine Apple laptops, phones, tablets, watches and audio, with a two-year warranty and free delivery over $150.',
  },
  hero: {
    type: 'lowImpact',
    richText: [
      {
        type: 'h1',
        children: [{ text: 'Premium tech, honestly priced' }],
      },
      {
        type: 'p',
        children: [
          {
            text: 'No page with the slug "home" exists in the database yet, so this placeholder supplies the metadata while the branded homepage renders around it. Sign in at /admin to publish one, or run `npm run seed:store` to load the demo catalogue.',
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
    title: 'Your cart | Tech Haven',
    description: 'Review the items in your Tech Haven cart and check out securely with Paynow.',
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
