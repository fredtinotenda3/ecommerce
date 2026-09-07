import React from 'react'
import { StaticImageData } from 'next/image'

import { Media as MediaType } from '../../../payload/payload-types'
import { StorefrontMediaLayoutBlock } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { Media } from '../../_components/Media'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13R: previously `Extract<Page['layout'][0], { blockType:
// 'mediaBlock' }>` (`Page` from `payload-types.ts`); now
// `invertBackground`/`position`/`id`/`blockName`/`blockType` come from the
// shared `StorefrontMediaLayoutBlock` view model
// (`src/app/_types/storefront.ts`) — same pattern as
// `CallToActionBlock`/`ContentBlock` (Phase 13L). `media` stays typed
// directly against `payload-types.ts`'s `Media` — it's passed straight
// through to `<Media resource={media} />` below, which needs the full
// shape; see that view model's header comment for why. `payload-types.ts`
// is still imported for this one field only, not for the rest of the
// block's shape.
type Props = StorefrontMediaLayoutBlock & {
  media: string | MediaType
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
