// src/app/(admin)/admin/page.tsx
//
// The admin dashboard: a handful of counts that answer "is anything
// waiting for me?", then the section links.
//
// The stats are counts of what the admin queries already return, not new
// aggregate queries — deliberately. A dashboard is the wrong place to
// introduce a query nobody has looked at under load, and these lists are
// already capped. The caps are stated in the hints rather than hidden, so a
// number that says "200+" is not mistaken for the true total.

import Link from 'next/link'

import {
  listAdminMediaNative,
  listAdminOrdersNative,
  listAdminProductsNative,
} from '../../_api/adminQueries'
import { ADMIN_SECTIONS } from './_components/sections'

import classes from './_components/admin.module.scss'

export const dynamic = 'force-dynamic'

const LIST_CAP = 200

/** "200" when the list came back at its cap, since the real total may be
 * higher and printing a capped number as if it were exact is a lie the
 * operator has no way to detect. */
const formatCount = (value: number): string => (value >= LIST_CAP ? `${LIST_CAP}+` : String(value))

export default async function AdminIndexPage() {
  let products: Awaited<ReturnType<typeof listAdminProductsNative>> = []
  let orders: Awaited<ReturnType<typeof listAdminOrdersNative>> = []
  let media: Awaited<ReturnType<typeof listAdminMediaNative>> = []
  let statsFailed = false

  try {
    ;[products, orders, media] = await Promise.all([
      listAdminProductsNative({ limit: LIST_CAP }),
      listAdminOrdersNative(),
      listAdminMediaNative(LIST_CAP),
    ])
  } catch (error) {
    // The section links are the useful part of this page and do not depend
    // on the database, so a failed read hides the stats rather than the
    // whole dashboard.
    statsFailed = true
    console.error('admin dashboard stats failed:', error) // eslint-disable-line no-console
  }

  const published = products.filter(product => product.status === 'published').length
  const unpriced = products.filter(product => product.price == null).length
  const awaitingFulfilment = orders.filter(
    order => order.status === 'PAID' || order.status === 'PROCESSING',
  ).length
  const missingAlt = media.filter(item => !item.alt).length

  const stats: { label: string; value: string; hint: string }[] = [
    {
      label: 'Published products',
      value: `${published}`,
      hint: `${formatCount(products.length)} in the catalogue${
        unpriced > 0 ? `, ${unpriced} with no price` : ''
      }`,
    },
    {
      label: 'Awaiting fulfilment',
      value: `${awaitingFulfilment}`,
      hint: `${formatCount(orders.length)} orders in total`,
    },
    {
      label: 'Media files',
      value: formatCount(media.length),
      hint: missingAlt > 0 ? `${missingAlt} without alt text` : 'All have alt text',
    },
  ]

  return (
    <>
      <div className={classes.pageHeader}>
        <div>
          <h1 className={classes.pageTitle}>Dashboard</h1>
          <p className={classes.pageSubtitle}>
            Everything that runs the store. Counts are over the most recent {LIST_CAP} records.
          </p>
        </div>
      </div>

      {statsFailed ? (
        <div className={classes.panel} role="alert" style={{ marginBottom: '1.5rem' }}>
          The dashboard counts could not be loaded. The sections below still work.
        </div>
      ) : (
        <div className={classes.statGrid}>
          {stats.map(stat => (
            <div key={stat.label} className={classes.stat}>
              <span className={classes.statLabel}>{stat.label}</span>
              <span className={classes.statValue}>{stat.value}</span>
              <span className={classes.statHint}>{stat.hint}</span>
            </div>
          ))}
        </div>
      )}

      <div className={classes.cardGrid}>
        {ADMIN_SECTIONS.map(section => (
          <Link key={section.href} href={section.href} className={classes.sectionCard}>
            <strong>{section.title}</strong>
            <p>{section.description}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
