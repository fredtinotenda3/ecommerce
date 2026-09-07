'use client'

import React from 'react'
import NextImage, { StaticImageData } from 'next/image'

import cssVariables from '../../../cssVariables'
import { Props as MediaProps } from '../types'

import classes from './index.module.scss'

const { breakpoints } = cssVariables

export const Image: React.FC<MediaProps> = props => {
  const {
    imgClassName,
    onClick,
    onLoad: onLoadFromProps,
    resource,
    priority,
    fill,
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
    alt = altFromResource

    // Prefer the record's own url, falling back to the filename for
    // records written before urls were stored. Root-relative either way:
    // an absolute URL built from NEXT_PUBLIC_SERVER_URL would break
    // whenever the configured origin and the origin actually being served
    // differ (a preview deployment, a proxy, local development on a
    // different port).
    src = urlFromResource || `/media/${fullFilename}`
  }

  // NOTE: this is used by the browser to determine which image to download at different screen sizes
  const sizes = Object.entries(breakpoints)
    .map(([, value]) => `(max-width: ${value}px) ${value}px`)
    .join(', ')

  return (
    <NextImage
      className={[isLoading && classes.placeholder, classes.image, imgClassName]
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
      sizes={sizes}
      priority={priority}
    />
  )
}
