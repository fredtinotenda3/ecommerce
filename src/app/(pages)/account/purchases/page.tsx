// src/app/(pages)/account/purchases/page.tsx
//
// Products this customer owns. `purchases` is stored as product ids, so
// each is resolved here for display.

import React from 'react'
import Link from 'next/link'

import { fetchProductCardById } from '../../../_api/fetchProduct'
import { Media } from '../../../_components/Media'
import { Price } from '../../../_components/Price'
import type { StorefrontProductCard } from '../../../_types/storefront'
import { getMeUser } from '../../../_utilities/getMeUser'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

export default async function Purchases() {
  const { user } = await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to access your account.',
    )}&redirect=${encodeURIComponent('/account')}`,
  })

  const purchaseIds = (user?.purchases || []).map(purchase =>
    typeof purchase === 'string' ? purchase : purchase.id,
  )

  // A product that has since been removed or unpublished resolves to null
  // and is simply not listed.
  const purchases = (
    await Promise.all(purchaseIds.map(id => fetchProductCardById(id).catch(() => null)))
  ).filter((product): product is StorefrontProductCard => Boolean(product))

  return (
    <div>
      <h5>Purchased Products</h5>
      <div>
        {purchases.length > 0 ? (
          <ul className={classes.purchases}>
            {purchases.map(purchase => (
              <li key={purchase.id} className={classes.purchase}>
                <Link href={`/products/${purchase.slug}`} className={classes.item}>
                  <div className={classes.mediaWrapper}>
                    {!purchase.meta?.image && <div className={classes.placeholder}>No image</div>}
                    {purchase.meta?.image && typeof purchase.meta.image !== 'string' && (
                      <Media imgClassName={classes.image} resource={purchase.meta.image} />
                    )}
                  </div>
                  <div className={classes.itemDetails}>
                    <h6>{purchase.title}</h6>
                    <Price product={purchase} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className={classes.noPurchases}>You have no purchases.</div>
        )}
      </div>
    </div>
  )
}
