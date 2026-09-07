import type { ElementType, Ref } from 'react'
import type { StaticImageData } from 'next/image'

import type { StorefrontMediaItem } from '../../_types/storefront'

export interface Props {
  src?: StaticImageData // for static media
  alt?: string
  // PHASE 13V: previously `string | payload-types.ts Media`. The Phase
  // 13N audit (see `StorefrontMediaItem`'s own doc comment in
  // `src/app/_types/storefront.ts`) traced every line of this component,
  // `Image/index.tsx`, and `Video/index.tsx` and confirmed the rendering
  // logic only ever reads `resource.mimeType`/`.width`/`.height`/
  // `.filename`/`.alt` — exactly the fields `StorefrontMediaItem` already
  // models — and that `payload-types.ts`'s generated `Media` has no
  // `.sizes` field to begin with (the caution in earlier phases' comments
  // about needing the full shape for "responsive `srcset` logic" described
  // a case that doesn't exist in this codebase's generated types). Every
  // real `payload-types.ts` `Media` object satisfies `StorefrontMediaItem`
  // unchanged, which is what makes this narrowing safe with no coordinated
  // changes anywhere else — see `tests/mediaResourceViewModel.test.ts`.
  resource?: string | StorefrontMediaItem // for Payload media
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
