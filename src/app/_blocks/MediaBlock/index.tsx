import React from 'react'
import { StaticImageData } from 'next/image'

import { StorefrontHeroMedia, StorefrontMediaLayoutBlock } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { Media } from '../../_components/Media'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13R: previously `Extract<Page['layout'][0], { blockType:
// 'mediaBlock' }>` (`Page` from `payload-types.ts`); now
// `invertBackground`/`position`/`id`/`blockName`/`blockType` come from the
// shared `StorefrontMediaLayoutBlock` view model
// (`src/app/_types/storefront.ts`) — same pattern as
// `CallToActionBlock`/`ContentBlock` (Phase 13L).
//
// PHASE 13V: `media` is now `string | StorefrontHeroMedia` instead of
// `payload-types.ts`'s full `Media` — this component reads `media.caption`
// directly (below), same as `HighImpactHero`, so it needs
// `StorefrontHeroMedia` (Phase 13V) rather than plain `StorefrontMediaItem`.
// This drops the `payload-types.ts` import from this file entirely.
type Props = StorefrontMediaLayoutBlock & {
  media: string | StorefrontHeroMedia
  staticImage?: StaticImageData
  id?: string
}

export const MediaBlock: React.FC<Props> = props => {
  const { media, position = 'default', staticImage } = props

  let caption
  if (media && typeof media === 'object') caption = media.caption

  return (
    <div className={classes.mediaBlock}>
      {position === 'fullscreen' && (
        <div className={classes.fullscreen}>
          <Media resource={media} src={staticImage} />
        </div>
      )}
      {position === 'default' && (
        <Gutter>
          <Media resource={media} src={staticImage} />
        </Gutter>
      )}
      {caption && (
        <Gutter className={classes.caption}>
          <RichText content={caption} />
        </Gutter>
      )}
    </div>
  )
}
