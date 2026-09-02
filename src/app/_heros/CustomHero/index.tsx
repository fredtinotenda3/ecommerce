import React, { Fragment } from 'react'

import { StorefrontHeroLinksContent, StorefrontMediaItem } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { CMSLink } from '../../_components/Link'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13L: previously `Page['hero']` (from `payload-types.ts`) in full;
// now `richText`/`links` come from the shared `StorefrontHeroLinksContent`
// view model (`src/app/_types/storefront.ts`). Unlike `HighImpactHero`/
// `MediumImpactHero`, `media` here is narrowed too — this component never
// passes `media` to the `Media` display component, it only reads
// `.filename` off it for a CSS `background-image` URL (see below), so the
// scalar-subset `StorefrontMediaItem` (Phase 13H) is a safe, sufficient
// type. This drops the `payload-types.ts` import entirely for this file.
type Props = StorefrontHeroLinksContent & { media?: string | StorefrontMediaItem }

export const CustomHero: React.FC<Props> = ({ richText, media, links }) => {
  const mediaUrl =
    media &&
    typeof media !== 'string' &&
    `${process.env.NEXT_PUBLIC_SERVER_URL}/media/${media.filename}`

  return (
    <section className={classes.hero}>
      <div className={classes.heroWrapper} style={{ backgroundImage: `url(${mediaUrl})` }}>
        <div className={classes.heroTextBox}>
          <RichText content={richText} />

          {Array.isArray(links) && links.length > 0 && (
            <ul className={classes.links}>
              {links.map(({ link }, i) => {
                return (
                  <li key={i}>
                    <CMSLink {...link} />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
