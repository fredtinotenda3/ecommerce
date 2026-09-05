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

// PHASE 13Q: previously `Page['hero']` (`Page` from `payload-types.ts`) —
// now the dispatcher-level `StorefrontHero` view model
// (`src/app/_types/storefront.ts`, `type` only), itself derived from
// `NativeHeroType` (`src/lib/domain/types.ts`). This drops the
// `payload-types.ts` import from this file entirely. Every real Payload
// `Page['hero']` (still passed in unchanged by every current caller — see
// `src/app/(pages)/[slug]/page.tsx`) satisfies `StorefrontHero` unchanged.
export const Hero: React.FC<StorefrontHero> = props => {
  const { type } = props || {}

  if (!type || type === 'none') return null

  const HeroToRender = heroes[type]

  if (!HeroToRender) return null

  // `props` is intentionally the narrow `StorefrontHero` dispatcher view
  // model (`type` only) — the chosen `_heros/*` component still needs its
  // own fuller prop type (`richText`/`links`/`media`; see
  // `StorefrontHeroLinksContent`/`StorefrontLowImpactHero` from Phase 13L,
  // plus each component's own locally-typed `media` field), which every
  // real caller of `Hero` (still a full `payload-types.ts` `Page['hero']`
  // object today) satisfies unchanged. The `@ts-expect-error` documents
  // that gap at the one place it matters, the same way `Blocks`' dispatcher
  // already does for its own per-block-type spread.
  // @ts-expect-error — see comment above: `props` (`StorefrontHero`) is
  // narrower than whichever `_heros/*` component's full prop type
  // `HeroToRender` resolves to; every real caller still supplies every
  // field that component actually reads.
  return <HeroToRender {...props} />
}
