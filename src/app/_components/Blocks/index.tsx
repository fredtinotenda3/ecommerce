import React, { Fragment } from 'react'

import { ArchiveBlock } from '../../_blocks/ArchiveBlock'
import { CallToActionBlock } from '../../_blocks/CallToAction'
import { ContentBlock } from '../../_blocks/Content'
import { MediaBlock } from '../../_blocks/MediaBlock'
import { RelatedProducts, type RelatedProductsProps } from '../../_blocks/RelatedProducts'
import { StorefrontLayoutBlock } from '../../_types/storefront'
import { toKebabCase } from '../../_utilities/toKebabCase'
import { BackgroundColor } from '../BackgroundColor/index'
import { VerticalPadding, VerticalPaddingOptions } from '../VerticalPadding/index'

const blockComponents = {
  cta: CallToActionBlock,
  content: ContentBlock,
  mediaBlock: MediaBlock,
  archive: ArchiveBlock,
  relatedProducts: RelatedProducts,
}

// PHASE 13Q: previously `(Page['layout'][0] | RelatedProductsProps)[]`
// (`Page` from `payload-types.ts`) — now the dispatcher-level
// `StorefrontLayoutBlock` view model (`src/app/_types/storefront.ts`),
// itself derived from `NativeLayoutBlock` (`src/lib/domain/types.ts`).
// This drops the `payload-types.ts` import from this file entirely. Every
// real Payload `Page['layout']` (still passed in unchanged by every current
// caller — see `src/app/(pages)/[slug]/page.tsx`, `products/page.tsx`,
// `cart/page.tsx`) and the `NativeLayoutBlock`-shaped array a future native
// producer would build satisfies `StorefrontLayoutBlock[]` unchanged.
export const Blocks: React.FC<{
  blocks: (StorefrontLayoutBlock | RelatedProductsProps)[]
  disableTopPadding?: boolean
  disableBottomPadding?: boolean
}> = props => {
  const { disableTopPadding, disableBottomPadding, blocks } = props

  const hasBlocks = blocks && Array.isArray(blocks) && blocks.length > 0

  if (hasBlocks) {
    return (
      <Fragment>
        {blocks.map((block, index) => {
          const { blockName, blockType } = block

          if (blockType && blockType in blockComponents) {
            const Block = blockComponents[blockType]

            // the cta block is containerized, so we don't consider it to be inverted at the block-level
            const blockIsInverted =
              'invertBackground' in block && blockType !== 'cta' ? block.invertBackground : false
            const prevBlock = blocks[index - 1]

            const prevBlockInverted =
              prevBlock && 'invertBackground' in prevBlock && prevBlock?.invertBackground

            const isPrevSame = Boolean(blockIsInverted) === Boolean(prevBlockInverted)

            let paddingTop: VerticalPaddingOptions = 'large'
            let paddingBottom: VerticalPaddingOptions = 'large'

            if (prevBlock && isPrevSame) {
              paddingTop = 'none'
            }

            if (index === blocks.length - 1) {
              paddingBottom = 'large'
            }

            if (disableTopPadding && index === 0) {
              paddingTop = 'none'
            }

            if (disableBottomPadding && index === 0) {
              paddingBottom = 'none'
            }

            if (Block) {
              // PHASE 13Q: `block` is now typed against the dispatcher-level
              // `StorefrontLayoutBlock | RelatedProductsProps` view model
              // (`id`/`blockName`/`blockType`/`invertBackground` only, plus
              // `RelatedProductsProps`'s own fields) rather than the full
              // per-block-type `payload-types.ts` union. `Block` here is
              // whichever concrete `_blocks/*` component matched `blockType`
              // at runtime, and each still declares its own fuller prop type
              // (some Phase-13L-narrowed, some still full `payload-types.ts`-
              // derived — see `blockComponents` above and each component's
              // own file). The `// @ts-expect-error` below (pre-existing,
              // not introduced by this phase) already covers the resulting
              // mismatch for the whole spread: TypeScript resolves `Block`'s
              // prop type as a union of all five components' prop types when
              // indexed this way, and no single object literal can satisfy
              // every member of that union at once — every real block this
              // dispatcher is ever called with (a real Payload block, a
              // native-producer-built block, or the literal
              // `relatedProducts` block `products/[slug]/page.tsx`
              // constructs) still has every field the runtime-matched
              // component actually reads; only the *static* type of `block`
              // is narrower than what every possible `Block` could demand.
              return (
                <BackgroundColor key={index} invert={blockIsInverted}>
                  <VerticalPadding top={paddingTop} bottom={paddingBottom}>
                    <Block
                      // @ts-expect-error
                      id={toKebabCase(blockName)}
                      {...block}
                    />
                  </VerticalPadding>
                </BackgroundColor>
              )
            }
          }
          return null
        })}
      </Fragment>
    )
  }

  return null
}
