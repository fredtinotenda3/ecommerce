'use client'

// src/app/_providers/Cart/index.tsx
//
// Cart state, held client-side and mirrored to durable storage:
//   - signed out: local storage only
//   - signed in:  synced to the customer's record via PATCH /api/account
//
// The cart here is a convenience for rendering and for carrying a selection
// across a login. It is never an input to what gets charged: checkout
// re-reads the cart from the database and re-derives every price
// server-side (see /api/checkout/paynow/initiate). A tampered local cart
// can therefore change what a customer sees, but not what they pay.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'

import { formatMoney } from '../../../lib/domain/money'
import type { StorefrontCartProduct, StorefrontPrice } from '../../_types/storefront'
import { useAuth } from '../Auth'
import { CartItem, CartType, cartReducer } from './reducer'

export type CartContext = {
  cart: CartType
  addItemToCart: (item: CartItem) => void
  deleteItemFromCart: (product: StorefrontCartProduct) => void
  cartIsEmpty: boolean | undefined
  clearCart: () => void
  isProductInCart: (product: StorefrontCartProduct) => boolean
  cartTotal: {
    formatted: string
    raw: number
    currency: string | null
  }
  hasInitializedCart: boolean
}

const Context = createContext({} as CartContext)

export const useCart = (): CartContext => useContext(Context)

const arrayHasItems = (array: unknown): boolean => Array.isArray(array) && array.length > 0

const EMPTY_TOTAL = { formatted: '', raw: 0, currency: null as string | null }

/** Sums the cart in minor units.
 *
 * Lines with no price are skipped rather than counted as zero — a product
 * without an authoritative price is not purchasable, and checkout will
 * reject it, so including it here would show a total the customer could
 * never be charged. A cart mixing currencies has no meaningful total
 * either, so it renders as blank; checkout rejects that case explicitly
 * (see MixedCurrencyCartError). */
const computeCartTotal = (items: CartItem[] | undefined): typeof EMPTY_TOTAL => {
  const prices: { price: StorefrontPrice; quantity: number }[] = []

  for (const item of items || []) {
    if (typeof item.product !== 'object' || !item.product?.price) continue
    prices.push({
      price: item.product.price,
      quantity: typeof item.quantity === 'number' ? item.quantity : 0,
    })
  }

  if (prices.length === 0) return EMPTY_TOTAL

  const currency = prices[0].price.currency
  if (prices.some(entry => entry.price.currency !== currency)) return EMPTY_TOTAL

  const raw = prices.reduce((acc, entry) => acc + entry.price.amount * entry.quantity, 0)

  return { formatted: formatMoney({ amount: raw, currency }), raw, currency }
}

export const CartProvider: React.FC<{ children?: React.ReactNode }> = props => {
  const { children } = props
  const { user, status: authStatus } = useAuth()

  const [cart, dispatchCart] = useReducer(cartReducer, { items: [] })
  const [total, setTotal] = useState(EMPTY_TOTAL)

  const hasInitialized = useRef(false)
  const [hasInitializedCart, setHasInitialized] = useState(false)

  // Rehydrate the locally stored cart: only product ids are persisted, so
  // each one is re-read from the API. That also drops anything that has
  // since been unpublished or deleted, and refreshes stale prices.
  useEffect(() => {
    if (hasInitialized.current) return
    hasInitialized.current = true

    const syncCartFromLocalStorage = async () => {
      let parsedCart: { items?: { product?: string; quantity?: number }[] } = {}

      try {
        parsedCart = JSON.parse(localStorage.getItem('cart') || '{}')
      } catch {
        parsedCart = {}
      }

      if (!parsedCart?.items?.length) {
        dispatchCart({ type: 'SET_CART', payload: { items: [] } })
        return
      }

      const initialCart = await Promise.all(
        parsedCart.items.map(async ({ product, quantity }) => {
          if (typeof product !== 'string') return null
          try {
            const res = await fetch(`/api/products/${product}`)
            if (!res.ok) return null
            const data = (await res.json()) as StorefrontCartProduct
            return { product: data, quantity }
          } catch {
            return null
          }
        }),
      )

      dispatchCart({
        type: 'SET_CART',
        payload: { items: initialCart.filter(Boolean) as CartItem[] },
      })
    }

    syncCartFromLocalStorage()
  }, [])

  // On login, merge whatever was in the local cart with the account's cart.
  // On logout, drop it from memory so the next visitor to this browser does
  // not inherit it.
  useEffect(() => {
    if (!hasInitialized.current) return

    if (authStatus === 'loggedIn') {
      dispatchCart({ type: 'MERGE_CART', payload: user?.cart })
    }

    if (authStatus === 'loggedOut') {
      dispatchCart({ type: 'CLEAR_CART' })
    }
  }, [user, authStatus])

  // Persist on every change, to the account when signed in and to local
  // storage otherwise.
  useEffect(() => {
    // Wait until authentication has resolved (user is an object or null).
    if (!hasInitialized.current || user === undefined) return

    // Only fully-populated lines are persisted; a line whose product could
    // not be resolved is dropped rather than written back as an id we can
    // no longer render.
    const flattenedCart = {
      items: (cart?.items || [])
        .map(item => {
          if (!item?.product || typeof item.product !== 'object') return null
          return {
            product: item.product.id,
            quantity: typeof item.quantity === 'number' ? item.quantity : 0,
          }
        })
        .filter(Boolean) as { product: string; quantity: number }[],
    }

    if (user) {
      const syncCartToAccount = async () => {
        try {
          const req = await fetch('/api/account', {
            credentials: 'include',
            method: 'PATCH',
            body: JSON.stringify({ cart: flattenedCart }),
            headers: { 'Content-Type': 'application/json' },
          })

          if (req.ok) {
            localStorage.setItem('cart', '{}')
          }
        } catch (e) {
          // A failed sync is not fatal: the in-memory cart still renders and
          // the next change retries.
          console.error('Unable to sync your cart right now.') // eslint-disable-line no-console
        }
      }

      syncCartToAccount()
    } else {
      localStorage.setItem('cart', JSON.stringify(flattenedCart))
    }

    setHasInitialized(true)
  }, [user, cart])

  const isProductInCart = useCallback(
    (incomingProduct: StorefrontCartProduct): boolean => {
      const { items: itemsInCart } = cart || {}
      if (!Array.isArray(itemsInCart)) return false

      return itemsInCart.some(({ product }) =>
        typeof product === 'string'
          ? product === incomingProduct.id
          : product?.id === incomingProduct.id,
      )
    },
    [cart],
  )

  /** Adds a new line or updates an existing one's quantity. */
  const addItemToCart = useCallback((incomingItem: CartItem) => {
    dispatchCart({ type: 'ADD_ITEM', payload: incomingItem })
  }, [])

  const deleteItemFromCart = useCallback((incomingProduct: StorefrontCartProduct) => {
    dispatchCart({ type: 'DELETE_ITEM', payload: incomingProduct })
  }, [])

  const clearCart = useCallback(() => {
    dispatchCart({ type: 'CLEAR_CART' })
  }, [])

  useEffect(() => {
    setTotal(computeCartTotal(cart?.items))
  }, [cart])

  return (
    <Context.Provider
      value={{
        cart,
        addItemToCart,
        deleteItemFromCart,
        cartIsEmpty: hasInitializedCart && !arrayHasItems(cart?.items),
        clearCart,
        isProductInCart,
        cartTotal: total,
        hasInitializedCart,
      }}
    >
      {children && children}
    </Context.Provider>
  )
}
