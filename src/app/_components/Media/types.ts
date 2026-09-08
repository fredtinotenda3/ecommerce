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
  /**
   * The `sizes` attribute, describing how wide this image renders at each
   * breakpoint. Pass it whenever the image is NOT full-viewport-width —
   * which is almost always. Getting it wrong is invisible on a fast desktop
   * connection and expensive everywhere else: the browser picks the source
   * file from this value, so a product tile that renders 280px wide but
   * declares 100vw downloads a 1280px file for no benefit.
   */
  sizes?: string
  /** JPEG/WebP quality passed to next/image. Defaults to 82. */
  quality?: number
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
