import type { StorefrontCartProduct } from '../../_types/storefront'

// PHASE 13P — `CartItem`/`CartType` below were previously re-exports of
// `payload-types.ts`'s generated `CartItems[0]` / `User['cart']`
// (`{ product?: string | Product; quantity?: number; id?: string }` /
// `{ items?: CartItems }`). They're now defined independently, with
// `Product` swapped for the narrower `StorefrontCartProduct` (see that
// type's doc comment in `src/app/_types/storefront.ts` for exactly which
// fields this reducer, `AddToCartButton`, and `RemoveFromCartButton`
// actually read off a cart line's product).
//
// This is safe with NO changes anywhere else that constructs/fetches a
// cart value: every real `payload-types.ts` `CartItems[0]` — and
// therefore every real `User['cart']` — satisfies these types unchanged,
// because the full generated `Product` type structurally satisfies the
// narrower `StorefrontCartProduct` (a real `Product` object has every
// field `StorefrontCartProduct` requires, plus more). The reverse is
// intentionally NOT required: nothing here needs a value typed against
// `StorefrontCartProduct` to also satisfy the full `Product` shape.
export type CartItem = {
  product?: string | StorefrontCartProduct
  quantity?: number
  id?: string
}

export type CartType =
  | {
      items?: CartItem[]
    }
  | null
  | undefined

type CartAction =
  | {
      type: 'SET_CART'
      payload: CartType
    }
  | {
      type: 'MERGE_CART'
      payload: CartType
    }
  | {
      type: 'ADD_ITEM'
      payload: CartItem
    }
  | {
      type: 'DELETE_ITEM'
      payload: StorefrontCartProduct
    }
  | {
      type: 'CLEAR_CART'
    }

export const cartReducer = (cart: CartType, action: CartAction): CartType => {
  switch (action.type) {
    case 'SET_CART': {
      return action.payload
    }

    case 'MERGE_CART': {
      const { payload: incomingCart } = action

      const syncedItems: CartItem[] = [
        ...(cart?.items || []),
        ...(incomingCart?.items || []),
      ].reduce((acc: CartItem[], item) => {
        // remove duplicates
        const productId = typeof item.product === 'string' ? item.product : item?.product?.id

        const indexInAcc = acc.findIndex(({ product }) =>
          typeof product === 'string' ? product === productId : product?.id === productId,
        ) // eslint-disable-line function-paren-newline

        if (indexInAcc > -1) {
          acc[indexInAcc] = {
            ...acc[indexInAcc],
            // customize the merge logic here, e.g.:
            // quantity: acc[indexInAcc].quantity + item.quantity
          }
        } else {
          acc.push(item)
        }
        return acc
      }, [])

      return {
        ...cart,
        items: syncedItems,
      }
    }

    case 'ADD_ITEM': {
      // if the item is already in the cart, increase the quantity
      const { payload: incomingItem } = action
      const productId =
        typeof incomingItem.product === 'string' ? incomingItem.product : incomingItem?.product?.id

      const indexInCart = cart?.items?.findIndex(({ product }) =>
        typeof product === 'string' ? product === productId : product?.id === productId,
      ) // eslint-disable-line function-paren-newline

      let withAddedItem = [...(cart?.items || [])]

      if (indexInCart === -1) {
        withAddedItem.push(incomingItem)
      }

      if (typeof indexInCart === 'number' && indexInCart > -1) {
        withAddedItem[indexInCart] = {
          ...withAddedItem[indexInCart],
          quantity: (incomingItem.quantity || 0) > 0 ? incomingItem.quantity : undefined,
        }
      }

      return {
        ...cart,
        items: withAddedItem,
      }
    }

    case 'DELETE_ITEM': {
      const { payload: incomingProduct } = action
      const withDeletedItem = { ...cart }

      const indexInCart = cart?.items?.findIndex(({ product }) =>
        typeof product === 'string'
          ? product === incomingProduct.id
          : product?.id === incomingProduct.id,
      ) // eslint-disable-line function-paren-newline

      if (typeof indexInCart === 'number' && withDeletedItem.items && indexInCart > -1)
        withDeletedItem.items.splice(indexInCart, 1)

      return withDeletedItem
    }

    case 'CLEAR_CART': {
      return {
        ...cart,
        items: [],
      }
    }

    default: {
      return cart
    }
  }
}
