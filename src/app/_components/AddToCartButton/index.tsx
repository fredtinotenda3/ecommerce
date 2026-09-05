'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { StorefrontCartProduct } from '../../_types/storefront'
import { useCart } from '../../_providers/Cart'
import { Button, Props } from '../Button'

import classes from './index.module.scss'

export const AddToCartButton: React.FC<{
  // PHASE 13P — narrowed from the full `payload-types.ts` `Product` to
  // `StorefrontCartProduct` (see that type's doc comment in
  // src/app/_types/storefront.ts): this component only ever reads
  // `product.id` (via `isProductInCart`) and forwards `product` whole
  // into `addItemToCart`'s `CartItem` payload, which itself now expects
  // `StorefrontCartProduct` (see `src/app/_providers/Cart/reducer.ts`).
  // Every existing caller (`ProductHero`, passing a real `Product`)
  // satisfies this unchanged.
  product: StorefrontCartProduct
  quantity?: number
  className?: string
  appearance?: Props['appearance']
}> = props => {
  const { product, quantity = 1, className, appearance = 'primary' } = props

  const { cart, addItemToCart, isProductInCart, hasInitializedCart } = useCart()

  const [isInCart, setIsInCart] = useState<boolean>()
  const router = useRouter()

  useEffect(() => {
    setIsInCart(isProductInCart(product))
  }, [isProductInCart, product, cart])

  return (
    <Button
      href={isInCart ? '/cart' : undefined}
      type={!isInCart ? 'button' : undefined}
      label={isInCart ? `✓ View in cart` : `Add to cart`}
      el={isInCart ? 'link' : undefined}
      appearance={appearance}
      className={[
        className,
        classes.addToCartButton,
        appearance === 'default' && isInCart && classes.green,
        !hasInitializedCart && classes.hidden,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={
        !isInCart
          ? () => {
              addItemToCart({
                product,
                quantity,
              })

              router.push('/cart')
            }
          : undefined
      }
    />
  )
}
