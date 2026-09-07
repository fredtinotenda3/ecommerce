// src/app/(pages)/account/orders/[id]/page.tsx

import React, { Fragment } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { fetchCustomerOrder } from '../../../../_api/orders'
import { HR } from '../../../../_components/HR'
import { Media } from '../../../../_components/Media'
import { Price } from '../../../../_components/Price'
import type { StorefrontOrderDetail } from '../../../../_types/storefront'
import { formatDateTime } from '../../../../_utilities/formatDateTime'
import { formatOrderTotal } from '../../../../_utilities/formatOrderTotal'
import { getMeUser } from '../../../../_utilities/getMeUser'
import { mergeOpenGraph } from '../../../../_utilities/mergeOpenGraph'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

export default async function AccountOrderPage({ params: { id } }) {
  const { user } = await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to view this order.',
    )}&redirect=${encodeURIComponent(`/account/orders/${id}`)}`,
  })

  let order: StorefrontOrderDetail | null = null

  try {
    order = await fetchCustomerOrder(id, user.id)
  } catch (error) {
    console.error('order read failed:', error) // eslint-disable-line no-console
  }

  if (!order) {
    notFound()
  }

  return (
    <div>
      <h5>
        {`Order`}
        <span className={classes.id}>{` ${order.orderNumber}`}</span>
      </h5>
      <div className={classes.itemMeta}>
        <p>{`Reference: ${order.orderNumber}`}</p>
        <p>{`Status: ${order.status}`}</p>
        {order.payment && <p>{`Payment: ${order.payment.provider} — ${order.payment.status}`}</p>}
        <p>{`Ordered On: ${formatDateTime(order.createdAt)}`}</p>
        <p className={classes.total}>{`Total: ${formatOrderTotal(order)}`}</p>
      </div>

      <div className={classes.order}>
        {order.items.map((item, index) => (
          <Fragment key={`${item.productId}-${index}`}>
            <div className={classes.row}>
              <Link href={`/products/${item.slug}`} className={classes.mediaWrapper}>
                {!item.image && <span className={classes.placeholder}>No image</span>}
                {item.image && typeof item.image !== 'string' && (
                  <Media
                    className={classes.media}
                    imgClassName={classes.image}
                    resource={item.image}
                    fill
                  />
                )}
              </Link>
              <div className={classes.rowContent}>
                <h6 className={classes.title}>
                  <Link href={`/products/${item.slug}`} className={classes.titleLink}>
                    {item.title}
                  </Link>
                </h6>
                <p>{`Quantity: ${item.quantity}`}</p>
                <Price
                  product={{ price: { amount: item.unitPrice, currency: item.currency } }}
                  button={false}
                  quantity={item.quantity}
                />
              </div>
            </div>
          </Fragment>
        ))}
      </div>
      <HR className={classes.hr} />
    </div>
  )
}

export async function generateMetadata({ params: { id } }): Promise<Metadata> {
  return {
    title: `Order ${id}`,
    description: `Order details for order ${id}.`,
    openGraph: mergeOpenGraph({
      title: `Order ${id}`,
      url: `/account/orders/${id}`,
    }),
  }
}
