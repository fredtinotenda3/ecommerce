import React from 'react'
import Link from 'next/link'

import { StorefrontCMSLink } from '../../_types/storefront'
import { Button, Props as ButtonProps } from '../Button'
import { resolveCMSLinkHref } from './resolveHref'

// PHASE 13K: previously a hand-written, standalone shape; now derived from
// `StorefrontCMSLink` (src/app/_types/storefront.ts), itself an
// `Omit<NativeCMSLink, ...>` of the native domain type
// (src/lib/domain/types.ts) — see that file's header comment for why
// `reference`/`icon`/`label` are narrowed rather than used as-is. `label`
// and `appearance` are re-widened here to this component's own,
// slightly different needs (`label` optional; `appearance` matches
// `ButtonProps['appearance']`, which includes `'none'` — used by
// `HeaderNav` — unlike `NativeCMSLink`'s `NativeLinkAppearance`). `icon`
// is dropped entirely — this component has never read it (only
// `FooterComponent` does, directly off the nav item, not through
// `CMSLink`) — same as the pre-13K shape. `children`/`className`/`invert`
// are this component's own additions, unrelated to the CMS link shape.
// Every existing caller already spreads a real Payload
// `Page['hero']['links'][number]['link']` (or the Header/Footer nav item
// equivalent), which satisfies this narrower shape unchanged.
type CMSLinkType = Omit<StorefrontCMSLink, 'appearance' | 'label' | 'icon'> & {
  label?: string
  appearance?: ButtonProps['appearance']
  children?: React.ReactNode
  className?: string
  invert?: ButtonProps['invert']
}

export const CMSLink: React.FC<CMSLinkType> = ({
  type,
  url,
  newTab,
  reference,
  label,
  appearance,
  children,
  className,
  invert,
}) => {
  const href = resolveCMSLinkHref({ type, reference, url })

  if (!href) return null

  if (!appearance) {
    const newTabProps = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}

    if (href || url) {
      return (
        <Link {...newTabProps} href={href || url} className={className}>
          {label && label}
          {children && children}
        </Link>
      )
    }
  }

  return (
    <Button
      className={className}
      newTab={newTab}
      href={href}
      appearance={appearance}
      label={label}
      invert={invert}
    />
  )
}
