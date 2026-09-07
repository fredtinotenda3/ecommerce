import React, { Fragment } from 'react'

import { StorefrontHeroLinksContent, StorefrontHeroMedia } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { CMSLink } from '../../_components/Link'
import { Media } from '../../_components/Media'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13L: previously `Page['hero']` (from `payload-types.ts`) in full;
// now `richText`/`links` come from the shared `StorefrontHeroLinksContent`
// view model (`src/app/_types/storefront.ts`), narrowed the same way as
// the other CMS block/hero components in this phase.
//
// PHASE 13V: `media` is now `string | StorefrontHeroMedia` instead of
// `payload-types.ts`'s full `Media` — the Phase 13N audit established
// `<Media resource={...} />` only reads the scalar fields
// `StorefrontMediaItem` already models, and this component additionally
// reads `media.caption` directly (below), which `StorefrontHeroMedia`
// (Phase 13V) adds on top of `StorefrontMediaItem`. This drops the
// `payload-types.ts` import from this file entirely.
type Props = StorefrontHeroLinksContent & { media: string | StorefrontHeroMedia }

export const HighImpactHero: React.FC<Props> = ({ richText, media, links }) => {
  return (
    <Gutter className={classes.hero}>
      <div className={classes.content}>
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
      <div className={classes.media}>
        {typeof media === 'object' && (
          <Fragment>
            <Media
              resource={media}
              // fill
              imgClassName={classes.image}
              priority
            />
            {media?.caption && <RichText content={media.caption} className={classes.caption} />}
          </Fragment>
        )}
      </div>
    </Gutter>
  )
}
