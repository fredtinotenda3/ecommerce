import React, { Fragment } from 'react'

import { Media as MediaType } from '../../../payload/payload-types'
import { StorefrontHeroLinksContent } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { CMSLink } from '../../_components/Link'
import { Media } from '../../_components/Media'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13L: previously `Page['hero']` (from `payload-types.ts`) in full;
// now `richText`/`links` come from the shared `StorefrontHeroLinksContent`
// view model (`src/app/_types/storefront.ts`), narrowed the same way as
// the other CMS block/hero components in this phase. `media` stays typed
// directly against `payload-types.ts`'s `Media` — it's passed straight
// through to `<Media resource={media} />` below, which needs the full
// shape (`.sizes`) for its responsive-image logic; see that file's header
// comment for why narrowing `media` here would be unsafe. `payload-types.ts`
// is still imported for this one field only, not for `richText`/`links`.
type Props = StorefrontHeroLinksContent & { media: string | MediaType }

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
