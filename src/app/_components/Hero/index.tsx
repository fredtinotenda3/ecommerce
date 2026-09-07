import React from 'react'

import { CustomHero } from '../../_heros/CustomHero'
import { HighImpactHero } from '../../_heros/HighImpact'
import { LowImpactHero } from '../../_heros/LowImpact'
import { MediumImpactHero } from '../../_heros/MediumImpact'
import { StorefrontHero } from '../../_types/storefront'

const heroes = {
  highImpact: HighImpactHero,
  mediumImpact: MediumImpactHero,
  lowImpact: LowImpactHero,
  customHero: CustomHero,
}

// The dispatcher reads only the hero's `type`; each variant component
// declares what it renders from the rest.
export const Hero: React.FC<StorefrontHero> = props => {
  const { type } = props || {}

  if (!type || type === 'none') return null

  const HeroToRender = heroes[type]

  if (!HeroToRender) return null

  // The dispatcher's own props are deliberately narrow (`type` only).
  // Each variant component declares the fuller shape it renders, which
  // every real caller supplies; this documents that gap at the one place
  // it matters.
  // @ts-expect-error — `StorefrontHero` is narrower than the resolved
  // variant component's prop type.
  return <HeroToRender {...props} />
}
