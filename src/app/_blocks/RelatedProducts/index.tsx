import React from 'react'

import type { StorefrontProductCard } from '../../_types/storefront'
import { Card } from '../../_components/Card'
import { Gutter } from '../../_components/Gutter'

import classes from './index.module.scss'

export type RelatedProductsProps = {
  blockType: 'relatedProducts'
  blockName: string
  introContent?: any
  /** Section heading. Defaults to "You might also like". */
  heading?: string
  docs?: (string | StorefrontProductCard)[]
  relationTo: 'products'
}

export const RelatedProducts: React.FC<RelatedProductsProps> = props => {
  const { docs, relationTo, heading = 'You might also like' } = props

  // Nothing to relate to: render nothing rather than a heading over an
  // empty row.
  const resolved = (docs || []).filter(
    (doc): doc is StorefrontProductCard => typeof doc !== 'string' && Boolean(doc),
  )

  if (resolved.length === 0) return null

  return (
    <section className={classes.relatedProducts} aria-labelledby="related-heading">
      <Gutter>
        <h2 id="related-heading" className={classes.title}>
          {heading}
        </h2>
        <div className={classes.grid}>
          {resolved.map(doc => (
            <Card key={doc.id} relationTo={relationTo} doc={doc} />
          ))}
        </div>
      </Gutter>
    </section>
  )
}
