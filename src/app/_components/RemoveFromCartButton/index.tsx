import React from 'react'
import Image from 'next/image'

import { StorefrontCartProduct } from '../../_types/storefront'
import { useCart } from '../../_providers/Cart'

import classes from './index.module.scss'

export const RemoveFromCartButton: React.FC<{
  className?: string
  // PHASE 13P — narrowed from the full `payload-types.ts` `Product` to
  // `StorefrontCartProduct` (see that type's doc comment in
  // src/app/_types/storefront.ts): this component only ever reads
  // `product.id`, via `isProductInCart`/`deleteItemFromCart`, both of
  // which now accept `StorefrontCartProduct` (see
  // `src/app/_providers/Cart/index.tsx`). Every existing caller
  // (`CartItem`, passing a real `Product`) satisfies this unchanged.
  product: StorefrontCartProduct
}> = props => {
  const { className, product } = props

  const { deleteItemFromCart, isProductInCart } = useCart()

  const productIsInCart = isProductInCart(product)

  if (!productIsInCart) {
    return <div>Item is not in the cart</div>
  }

  return (
    <button
      type="button"
      onClick={() => {
        deleteItemFromCart(product)
      }}
      className={[className, classes.removeFromCartButton].filter(Boolean).join(' ')}
    >
      <Image
        src="/assets/icons/delete.svg"
        alt="delete"
        width={24}
        height={24}
        className={classes.qtnBt}
      />
    </button>
  )
}
