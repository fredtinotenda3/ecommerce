// src/app/_components/InclusionIcon/index.tsx
//
// The line-art glyph for one of Settings' admin-editable "trust badge"
// inclusions (see `/admin/globals` -> Settings -> Trust badges), shared by
// `Home/ValueProps` and `ProductHero` so the two never draw a different
// icon for the same `icon` value.
//
// Keyed on the `icon` ENUM (`box` | `repair` | `payment` | `message`), not
// on the inclusion's free-typed title — the previous version matched on
// the exact title string, which meant renaming a trust badge in the admin
// silently fell back to a generic glyph. An enum can't drift like that.
//
// Stroked/line-art rather than the supplied filled icon set: at this size a
// stroked icon inheriting `currentColor` stays crisp and re-colours itself
// for the dark theme, where a fixed-colour raster cannot.

import React from 'react'

import type { StorefrontInclusionIcon } from '../../_types/storefront'

const ICONS: Record<StorefrontInclusionIcon, JSX.Element> = {
  box: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M3 7.5V16l9 4.5 9-4.5V7.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12v8.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  repair: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5l-6 6 2.4 2.4 6-6a4 4 0 0 0 5-5.4l-2.6 2.6-2-.5-.5-2 2.6-2.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  payment: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 14.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  message: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5h16v10H9l-4 3.5v-3.5H4V5.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

export const InclusionIcon: React.FC<{ icon: StorefrontInclusionIcon }> = ({ icon }) =>
  ICONS[icon] ?? ICONS.box
