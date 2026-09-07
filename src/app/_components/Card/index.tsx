'use client'

import React from 'react'
import Link from 'next/link'

import type { StorefrontProductCard } from '../../_types/storefront'
import { Media } from '../Media'
import { Price } from '../Price'

import classes from './index.module.scss'

export const Card: React.FC<{
  alignItems?: 'center'
  className?: string
  showCategories?: boolean
  hideImagesOnMobile?: boolean
  title?: string
  relationTo?: 'products'
  doc?: StorefrontProductCard
}> = props => {
  const { title: titleFromProps, doc, className } = props

  const { slug, title, meta } = doc || {}
  const { description, image: metaImage } = meta || {}

  const titleToUse = titleFromProps || title
  // Non-breaking spaces come out of rich text editors and break wrapping.
  const sanitizedDescription = description?.replace(/\s/g, ' ')
  const href = `/products/${slug}`

  return (
    <Link href={href} className={[classes.card, className].filter(Boolean).join(' ')}>
      <div className={classes.mediaWrapper}>
        {!metaImage && <div className={classes.placeholder}>No image</div>}
        {metaImage && typeof metaImage !== 'string' && (
          <Media imgClassName={classes.image} resource={metaImage} fill />
        )}
      </div>

      <div className={classes.content}>
        {titleToUse && <h4 className={classes.title}>{titleToUse}</h4>}
        {description && (
          <div className={classes.body}>
            <p className={classes.description}>{sanitizedDescription}</p>
          </div>
        )}
        {doc && <Price product={doc} />}
      </div>
    </Link>
  )
}
