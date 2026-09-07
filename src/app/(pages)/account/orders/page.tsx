// src/app/(pages)/account/orders/page.tsx

import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'

import { fetchCustomerOrders } from '../../../_api/orders'
import { Button } from '../../../_components/Button'
import { RenderParams } from '../../../_components/RenderParams'
import type { StorefrontOrderSummary } from '../../../_types/storefront'
import { formatDateTime } from '../../../_utilities/formatDateTime'
import { formatOrderTotal } from '../../../_utilities/formatOrderTotal'
import { getMeUser } from '../../../_utilities/getMeUser'
import { mergeOpenGraph } from '../../../_utilities/mergeOpenGraph'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

export default async function AccountOrders() {
  const { user } = await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to view your orders.',
    )}&redirect=${encodeURIComponent('/account/orders')}`,
  })

  let orders: StorefrontOrderSummary[] = []

  try {
    orders = await fetchCustomerOrders(user.id)
  } catch (error) {
    console.error('order list read failed:', error) // eslint-disable-line no-console
  }

  return (
    <div>
      <h5>My Orders</h5>
      {orders.length === 0 && <p className={classes.noOrders}>You have no orders.</p>}
      <RenderParams />
      {orders.length > 0 && (
        <ul className={classes.orders}>
          {orders.map(order => (
            <li key={order.id} className={classes.order}>
              <Link className={classes.item} href={`/account/orders/${order.id}`}>
                <div className={classes.itemContent}>
                  <h6 className={classes.itemTitle}>{`Order ${order.orderNumber}`}</h6>
                  <div className={classes.itemMeta}>
                    <p>{`Total: ${formatOrderTotal(order)}`}</p>
                    <p className={classes.orderDate}>{`Ordered On: ${formatDateTime(
                      order.createdAt,
                    )}`}</p>
                  </div>
                </div>
                <Button
                  appearance="default"
                  label="View Order"
                  className={classes.button}
                  el="button"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export const metadata: Metadata = {
  title: 'Orders',
  description: 'Your orders.',
  openGraph: mergeOpenGraph({
    title: 'Orders',
    url: '/account/orders',
  }),
}
