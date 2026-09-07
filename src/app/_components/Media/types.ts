import type { ElementType, Ref } from 'react'
import type { StaticImageData } from 'next/image'

import type { StorefrontMediaItem } from '../../_types/storefront'

export interface Props {
  src?: StaticImageData // for static media
  alt?: string
  /** Either an unresolved media id or a populated media object. This
   * component and its Image/Video children read only `mimeType`, `width`,
   * `height`, `filename` and `alt` — the fields `StorefrontMediaItem`
   * models. */
  resource?: string | StorefrontMediaItem
  size?: string // for NextImage only
  priority?: boolean // for NextImage only
  fill?: boolean // for NextImage only
  className?: string
  imgClassName?: string
  videoClassName?: string
  htmlElement?: ElementType | null
  onClick?: () => void
  onLoad?: () => void
  ref?: Ref<null | HTMLImageElement | HTMLVideoElement>
}
