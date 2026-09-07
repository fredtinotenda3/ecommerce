// src/app/(pages)/orders/page.tsx

import React from 'react'
import { Metadata } from 'next'
import Link from 'next/link'

import { fetchCustomerOrders } from '../../_api/orders'
import { Button } from '../../_components/Button'
import { Gutter } from '../../_components/Gutter'
import { RenderParams } from '../../_components/RenderParams'
import type { StorefrontOrderSummary } from '../../_types/storefront'
import { formatDateTime } from '../../_utilities/formatDateTime'
import { formatOrderTotal } from '../../_utilities/formatOrderTotal'
import { getMeUser } from '../../_utilities/getMeUser'
import { mergeOpenGraph } from '../../_utilities/mergeOpenGraph'

import classes from './index.module.scss'

export const dynamic = 'force-dynamic'

export default async function Orders() {
  // Orders are read directly for the session's own customer id — there is
  // no id in the URL to tamper with.
  const { user } = await getMeUser({
    nullUserRedirect: `/login?error=${encodeURIComponent(
      'You must be logged in to view your orders.',
    )}&redirect=${encodeURIComponent('/orders')}`,
  })

  let orders: StorefrontOrderSummary[] = []

  try {
    orders = await fetchCustomerOrders(user.id)
  } catch (error) {
    console.error('order list read failed:', error) // eslint-disable-line no-console
  }

  return (
    <Gutter className={classes.orders}>
      <h1>Orders</h1>
      {orders.length === 0 && <p className={classes.noOrders}>You have no orders.</p>}
      <RenderParams />
      {orders.length > 0 && (
        <ul className={classes.ordersList}>
          {orders.map(order => (
            <li key={order.id} className={classes.listItem}>
              <Link className={classes.item} href={`/orders/${order.id}`}>
                <div className={classes.itemContent}>
                  <h4 className={classes.itemTitle}>{`Order ${order.orderNumber}`}</h4>
                  <div className={classes.itemMeta}>
                    <p>{`Ordered On: ${formatDateTime(order.createdAt)}`}</p>
                    <p>{`Total: ${formatOrderTotal(order)}`}</p>
                    <p>{`Status: ${order.status}`}</p>
                  </div>
                </div>
                <Button
                  appearance="secondary"
                  label="View order"
                  className={classes.button}
                  el="button"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Gutter>
  )
}

export const metadata: Metadata = {
  title: 'Orders',
  description: 'Your orders.',
  openGraph: mergeOpenGraph({
    title: 'Orders',
    url: '/orders',
  }),
}
