// src/app/(pages)/orders/[id]/page.tsx

import React, { Fragment } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { fetchCustomerOrder } from '../../../_api/orders'
import { Button } from '../../../_components/Button'
import { Gutter } from '../../../_components/Gutter'
import { HR } from '../../../_components/HR'
import { Media } from '../../../_components/Media'
import { Price } from '../../../_components/Price'
import type { StorefrontOrderDetail } from '../../../_types/storefront'
import { formatDateTime } from '../../../_utilities/formatDateTime'
import { formatOrderTotal } from '../../../_utilities/formatOrderTotal'
import { getMeUser } from '../../../_utilities/getMeUser'
import { mergeOpenGraph } from '../../../_utilities/mergeOpenGraph'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

export default async function OrderPage({ params: { id } }) {
  const { user } = await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to view this order.',
    )}&redirect=${encodeURIComponent(`/orders/${id}`)}`,
  })

  let order: StorefrontOrderDetail | null = null

  try {
    // Scoped to this customer: another customer's order reads as missing.
    order = await fetchCustomerOrder(id, user.id)
  } catch (error) {
    console.error('order read failed:', error) // eslint-disable-line no-console
  }

  if (!order) {
    notFound()
  }

  return (
    <Gutter className={classes.orders}>
      <h1>
        {`Order`}
        <span className={classes.id}>{` ${order.orderNumber}`}</span>
      </h1>
      <div className={classes.itemMeta}>
        <p>{`Reference: ${order.orderNumber}`}</p>
        <p>{`Status: ${order.status}`}</p>
        {order.payment && <p>{`Payment: ${order.payment.provider} — ${order.payment.status}`}</p>}
        <p>{`Ordered On: ${formatDateTime(order.createdAt)}`}</p>
        <p className={classes.total}>{`Total: ${formatOrderTotal(order)}`}</p>
      </div>
      <HR />
      <div className={classes.order}>
        <h4 className={classes.orderItems}>Items</h4>
        {order.items.map((item, index) => {
          const isLast = index === order.items.length - 1

          return (
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
                  <h5 className={classes.title}>
                    <Link href={`/products/${item.slug}`} className={classes.titleLink}>
                      {item.title}
                    </Link>
                  </h5>
                  <p>{`Quantity: ${item.quantity}`}</p>
                  {/* The price charged at the time of the order, never the
                      product's current price. */}
                  <Price
                    product={{ price: { amount: item.unitPrice, currency: item.currency } }}
                    button={false}
                    quantity={item.quantity}
                  />
                </div>
              </div>
              {!isLast && <HR />}
            </Fragment>
          )
        })}
      </div>
      <HR />
      <div className={classes.actions}>
        <Button href="/orders" appearance="primary" label="See all orders" />
        <Button href="/account" appearance="secondary" label="Go to account" />
      </div>
    </Gutter>
  )
}

export async function generateMetadata({ params: { id } }): Promise<Metadata> {
  return {
    title: `Order ${id}`,
    description: `Order details for order ${id}.`,
    openGraph: mergeOpenGraph({
      title: `Order ${id}`,
      url: `/orders/${id}`,
    }),
  }
}
