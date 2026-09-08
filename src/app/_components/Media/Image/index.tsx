'use client'

import React from 'react'
import NextImage, { StaticImageData } from 'next/image'

import { Props as MediaProps } from '../types'

import classes from './index.module.scss'

/**
 * Fallback `sizes` for a caller that does not supply one.
 *
 * It describes an image that is full-width on a phone, roughly half the
 * viewport on a tablet and a third on a desktop — a reasonable guess for a
 * grid tile. It is deliberately NOT `100vw`: the previous implementation
 * built its sizes list from the breakpoint map, which declared every image
 * to be the full viewport width at every breakpoint, so a 280px product tile
 * downloaded the 1280px rendition. Callers that know their layout should
 * still pass `sizes` explicitly.
 */
const DEFAULT_SIZES = '(max-width: 640px) 92vw, (max-width: 1024px) 46vw, 30vw'

export const Image: React.FC<MediaProps> = props => {
  const {
    imgClassName,
    onClick,
    onLoad: onLoadFromProps,
    resource,
    priority,
    fill,
    sizes: sizesFromProps,
    quality = 82,
    src: srcFromProps,
    alt: altFromProps,
  } = props

  const [isLoading, setIsLoading] = React.useState(true)

  let width: number | undefined
  let height: number | undefined
  let alt = altFromProps
  let src: StaticImageData | string = srcFromProps || ''

  if (!src && resource && typeof resource !== 'string') {
    const {
      width: fullWidth,
      height: fullHeight,
      filename: fullFilename,
      url: urlFromResource,
      alt: altFromResource,
    } = resource

    width = fullWidth
    height = fullHeight
    // Only take the record's alt when the caller has not supplied one:
    // a caller with page context often knows better than the media library.
    alt = altFromProps ?? altFromResource

    // Prefer the record's own url, falling back to the filename for
    // records written before urls were stored. Root-relative either way:
    // an absolute URL built from NEXT_PUBLIC_SERVER_URL would break
    // whenever the configured origin and the origin actually being served
    // differ (a preview deployment, a proxy, local development on a
    // different port).
    src = urlFromResource || `/media/${fullFilename}`
  }

  if (!src) return null

  return (
    <NextImage
      className={[isLoading && classes.loading, classes.image, imgClassName]
        .filter(Boolean)
        .join(' ')}
      src={src}
      alt={alt || ''}
      onClick={onClick}
      onLoad={() => {
        setIsLoading(false)
        if (typeof onLoadFromProps === 'function') {
          onLoadFromProps()
        }
      }}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      sizes={sizesFromProps || DEFAULT_SIZES}
      quality={quality}
      priority={priority}
      // Anything not marked priority is below the fold by definition here.
      loading={priority ? undefined : 'lazy'}
    />
  )
}
