import React from 'react'

import { StorefrontLowImpactHero } from '../../_types/storefront'
import { Gutter } from '../../_components/Gutter'
import RichText from '../../_components/RichText'
import { VerticalPadding } from '../../_components/VerticalPadding'

import classes from './index.module.scss'

// PHASE 13L: previously `Page['hero']` (from `payload-types.ts`) in full,
// even though this component only ever reads `richText`; now the
// dedicated `StorefrontLowImpactHero` view model
// (`src/app/_types/storefront.ts`). Drops the `payload-types.ts` import
// entirely for this file.
export const LowImpactHero: React.FC<StorefrontLowImpactHero> = ({ richText }) => {
  return (
    <Gutter className={classes.lowImpactHero}>
      <div className={classes.content}>
        <VerticalPadding>
          <RichText className={classes.richText} content={richText} />
        </VerticalPadding>
      </div>
    </Gutter>
  )
}
