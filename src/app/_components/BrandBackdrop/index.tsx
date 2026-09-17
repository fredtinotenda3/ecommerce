// src/app/_components/BrandBackdrop/index.tsx
//
// The site-wide decorative backdrop: a fixed, low-opacity wash of the
// admin-configured "electric-blue circuit" background image (Settings ->
// Brand background image, see `/admin/globals`), sitting behind every page.
//
// Deliberately subtle: this is a MOOD layer, not a hero image. It renders
// only in one corner, fades to nothing within a quarter of the viewport,
// and never intrudes on text contrast — a shopper reading a product
// description should never notice this except as "the site feels
// branded", the same way the existing footer/hero bands already use this
// image at a much higher, page-specific strength.
//
// Renders nothing at all (not even the wrapping div) when no background
// image has been configured, so a fresh install is a plain page rather
// than a broken background reference — same "null is not an error"
// treatment as every other Settings-driven field in this app.

import React from 'react'

import classes from './index.module.scss'

export interface BrandBackdropProps {
  imageUrl?: string | null
}

export const BrandBackdrop: React.FC<BrandBackdropProps> = ({ imageUrl }) => {
  if (!imageUrl) return null

  return (
    <div
      className={classes.backdrop}
      aria-hidden="true"
      style={{ backgroundImage: `url(${imageUrl})` }}
    />
  )
}
