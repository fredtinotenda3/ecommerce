import React from 'react'

import { StorefrontCallToActionBlock } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import { CMSLink } from '../../_components/Link'
import RichText from '../../_components/RichText'
import { VerticalPadding } from '../../_components/VerticalPadding'

import classes from './index.module.scss'

// PHASE 13L: previously `Extract<Page['layout'][0], { blockType: 'cta' }>`
// (from `payload-types.ts`); now the `StorefrontCallToActionBlock` view
// model (`src/app/_types/storefront.ts`), itself derived from
// `NativeCallToActionBlock` (`src/lib/domain/types.ts`) with `links`
// narrowed the same way `StorefrontHeader`/`StorefrontFooter` narrowed
// `navItems` in Phase 13K. Every real Payload `cta` block satisfies this
// unchanged — see that file's header comment for the full derivation.
type Props = StorefrontCallToActionBlock

export const CallToActionBlock: React.FC<
  Props & {
    id?: string
  }
> = ({ links, richText, invertBackground }) => {
  return (
    <Gutter>
      <VerticalPadding
        className={[classes.callToAction, invertBackground && classes.invert]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={classes.wrap}>
          <div className={classes.content}>
            <RichText className={classes.richText} content={richText} />
          </div>
          <div className={classes.linkGroup}>
            {(links || []).map(({ link }, i) => {
              return <CMSLink key={i} {...link} invert={invertBackground} />
            })}
          </div>
        </div>
      </VerticalPadding>
    </Gutter>
  )
}
