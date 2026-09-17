// src/app/_components/Home/ValueProps/index.tsx
//
// The "why buy here" band.
//
// It exists because the homepage otherwise went straight from a promotion to
// social proof, with nothing between the offer and the testimonials
// answering the obvious question a first-time visitor has: why you and not
// the shop down the road.
//
// ADMIN-MANAGED CONTENT. The trust badges themselves come from Settings'
// `inclusions` (see `/admin/globals`), not a hardcoded list — falls back to
// `siteDefaults.ts` when unset, same "null is not an error" treatment as
// every other Settings-driven field. The heading copy ("Why Terro
// Technology") stays fixed in this file: it names the SITE, and threading
// a site name into a page-section heading for one band is more churn than
// it is worth for a heading an operator would want to change roughly as
// often as the inclusions themselves change (rarely).
//
// Server component: static copy and inline SVG, no interactivity.

import React from 'react'

import { DEFAULT_INCLUSIONS, DEFAULT_SITE_NAME } from '../../../../lib/domain/siteDefaults'
import { StorefrontSettingsLike } from '../../../_types/storefront'
import { InclusionIcon } from '../../InclusionIcon'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

export interface ValuePropsProps {
  settings?: StorefrontSettingsLike | null
}

export const ValueProps: React.FC<ValuePropsProps> = ({ settings }) => {
  const inclusions =
    settings?.inclusions && settings.inclusions.length > 0 ? settings.inclusions : DEFAULT_INCLUSIONS

  if (inclusions.length === 0) return null

  return (
    <section className={classes.section} aria-labelledby="value-heading">
      <Gutter>
        <div className={classes.header}>
          <p className={classes.eyebrow}>Why {settings?.siteName || DEFAULT_SITE_NAME}</p>
          <h2 id="value-heading" className={classes.heading}>
            The part most shops leave out
          </h2>
        </div>

        <ul className={classes.grid}>
          {inclusions.map(inclusion => (
            <li key={inclusion.title} className={classes.item}>
              <span className={classes.icon}>
                <InclusionIcon icon={inclusion.icon} />
              </span>
              <h3 className={classes.itemTitle}>{inclusion.title}</h3>
              <p className={classes.itemCopy}>{inclusion.description}</p>
            </li>
          ))}
        </ul>
      </Gutter>
    </section>
  )
}
