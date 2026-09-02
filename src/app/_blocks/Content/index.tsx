import React from 'react'

import { StorefrontContentBlock } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { CMSLink } from '../../_components/Link'
import RichText from '../../_components/RichText'

import classes from './index.module.scss'

// PHASE 13L: previously `Extract<Page['layout'][0], { blockType: 'content' }>`
// (from `payload-types.ts`); now the `StorefrontContentBlock` view model
// (`src/app/_types/storefront.ts`), itself derived from `NativeContentBlock`
// (`src/lib/domain/types.ts`) with each column's `link` narrowed the same
// way `CMSLink`'s own prop type was narrowed in Phase 13K. Every real
// Payload `content` block satisfies this unchanged — see that file's
// header comment for the full derivation.
type Props = StorefrontContentBlock

export const ContentBlock: React.FC<
  Props & {
    id?: string
  }
> = props => {
  const { columns } = props

  return (
    <Gutter className={classes.content}>
      <div className={classes.grid}>
        {columns &&
          columns.length > 0 &&
          columns.map((col, index) => {
            const { enableLink, richText, link, size } = col

            return (
              <div key={index} className={[classes.column, classes[`column--${size}`]].join(' ')}>
                <RichText content={richText} />
                {enableLink && <CMSLink className={classes.link} {...link} />}
              </div>
            )
          })}
      </div>
    </Gutter>
  )
}
