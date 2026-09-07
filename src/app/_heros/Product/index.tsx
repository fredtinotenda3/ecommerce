import React, { Fragment } from 'react'

import { AddToCartButton } from '../../_components/AddToCartButton'
import { Gutter } from '../../_components/Gutter'
import { Media } from '../../_components/Media'
import { Price } from '../../_components/Price'
import {
  StorefrontMediaItem,
  StorefrontProductCategoryRef,
  StorefrontProductHeroView,
} from '../../_types/storefront'

import classes from './index.module.scss'

// PHASE 13U: previously the full `payload-types.ts` `Product`; now
// `id`/`title`/`slug`/`priceJSON`/`categories` come from the shared
// `StorefrontProductHeroView` view model (`src/app/_types/storefront.ts`).
//
// PHASE 13V: `meta.image` is now `string | StorefrontMediaItem` instead of
// `payload-types.ts`'s full `Media` — the Phase 13N audit established
// `<Media resource={...} />` only reads the scalar fields
// `StorefrontMediaItem` already models (see that type's own doc comment).
// This is stricter than `StorefrontProductHeroView`'s own `meta.image`
// (inherited from `StorefrontCartProduct`'s `StorefrontMediaRef`, just
// `.url` — sufficient for the Cart row's plain thumbnail use, but not
// self-documenting enough for `<Media resource={...} fill />`'s actual
// field reads here), hence this `Omit<..., 'meta'> & { meta?: ... }`
// override, same pattern as the Phase 13U original. This drops the
// `payload-types.ts` import from this file entirely.
type ProductHeroProduct = Omit<StorefrontProductHeroView, 'meta'> & {
  meta?: {
    image?: string | StorefrontMediaItem
    description?: string | null
  } | null
}

export const ProductHero: React.FC<{
  product: ProductHeroProduct
}> = ({ product }) => {
  const { title, categories, meta: { image: metaImage, description } = {} } = product

  return (
    <Gutter className={classes.productHero}>
      <div className={classes.mediaWrapper}>
        {!metaImage && <div className={classes.placeholder}>No image</div>}
        {metaImage && typeof metaImage !== 'string' && (
          <Media imgClassName={classes.image} resource={metaImage} fill />
        )}
      </div>

      <div className={classes.details}>
        <h3 className={classes.title}>{title}</h3>

        <div className={classes.categoryWrapper}>
          <div className={classes.categories}>
            {categories?.map((category, index) => {
              const { title: categoryTitle } = category as StorefrontProductCategoryRef

              const titleToUse = categoryTitle || 'Generic'
              const isLast = index === categories.length - 1

              return (
                <p key={index} className={classes.category}>
                  {titleToUse} {!isLast && <Fragment>, &nbsp;</Fragment>}
                  <span className={classes.separator}>|</span>
                </p>
              )
            })}
          </div>
          <p className={classes.stock}> In stock</p>
        </div>

        <Price product={product} button={false} />

        <div className={classes.description}>
          <h6>Description</h6>
          <p>{description}</p>
        </div>

        <AddToCartButton product={product} className={classes.addToCartButton} />
      </div>
    </Gutter>
  )
}
