// src/app/_data/fallbackPages.ts
//
// Content rendered when the database has no `home` or `cart` page yet.
//
// This exists so a freshly provisioned deployment shows something coherent
// instead of a 404 while the catalogue is still being set up. It is a
// rendering fallback only — nothing here is written to the database, and a
// real page with the same slug always takes precedence.
//
// Everything here is CUSTOMER-FACING copy. It must never mention the
// database, the admin area, a seed script or a slug: a visitor who lands
// on a half-configured store should see a shop that happens to be quiet,
// not a developer's setup note.

import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME, DEFAULT_SITE_TAGLINE } from '../../lib/domain/siteDefaults'
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
    title: `${DEFAULT_SITE_NAME} — ${DEFAULT_SITE_TAGLINE}`,
    // No warranty term or delivery threshold invented here — the previous
    // (Tech Haven) fallback stated "a two-year warranty and free delivery
    // over $150", neither of which any Terro Technology asset confirms.
    description: DEFAULT_SITE_DESCRIPTION,
  },
  hero: {
    type: 'lowImpact',
    richText: [
      {
        type: 'h1',
        children: [{ text: DEFAULT_SITE_TAGLINE }],
      },
      {
        type: 'p',
        children: [{ text: DEFAULT_SITE_DESCRIPTION }],
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
    title: `Your cart | ${DEFAULT_SITE_NAME}`,
    description: `Review the items in your cart and check out securely with Paynow.`,
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
