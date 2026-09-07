import React from 'react'

import { StorefrontHeroLinksContent, StorefrontMediaItem } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { CMSLink } from '../../_components/Link'
import { Media } from '../../_components/Media'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13L: previously `Page['hero']` (from `payload-types.ts`) in full;
// now `richText`/`links` come from the shared `StorefrontHeroLinksContent`
// view model (`src/app/_types/storefront.ts`) — same reasoning as
// `HighImpactHero`.
//
// PHASE 13V: `media` is now `string | StorefrontMediaItem` instead of
// `payload-types.ts`'s full `Media` — unlike `HighImpactHero`, this
// component never reads `media.caption`, so the plain scalar-subset
// `StorefrontMediaItem` (Phase 13H) is sufficient; no need for
// `StorefrontHeroMedia`. This drops the `payload-types.ts` import from
// this file entirely.
type Props = StorefrontHeroLinksContent & { media: string | StorefrontMediaItem }

export const MediumImpactHero: React.FC<Props> = props => {
  const { richText, media, links } = props

  return (
    <Gutter className={classes.hero}>
      <div className={classes.background}>
        <RichText className={classes.richText} content={richText} />
        {Array.isArray(links) && (
          <ul className={classes.links}>
            {links.map(({ link }, i) => {
              return (
                <li key={i}>
                  <CMSLink className={classes.link} {...link} />
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className={classes.media}>
        {typeof media === 'object' && <Media className={classes.media} resource={media} />}
      </div>
    </Gutter>
  )
}
