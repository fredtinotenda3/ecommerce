'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { StorefrontFooter, StorefrontMediaItem } from '../../../_types/storefront'
import { inclusions, noHeaderFooterUrls, profileNavItems } from '../../../constants'
import { Button } from '../../Button'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

// PHASE 13K: narrowed from `payload-types.ts`'s `Footer` to
// `StorefrontFooter` (src/app/_types/storefront.ts) — this component only
// ever reads `.copyright` and `.navItems[].link.{url,label,icon}`. Every
// real `payload-types.ts` `Footer` (default GraphQL path), and everything
// the native `globalsStorefrontAdapter.ts`/`fetchGlobalsNative.ts` path
// produces, satisfies this unchanged.
const FooterComponent = ({ footer }: { footer: StorefrontFooter | null }) => {
  // PHASE 13D: see the matching comment in
  // src/app/_components/Header/HeaderComponent/index.tsx — `usePathname`
  // is called unconditionally here (react-hooks/rules-of-hooks); a
  // render-phase crash inside it is guarded against one level up by an
  // `ErrorBoundary` (see src/app/_components/Footer/index.tsx).
  const pathname = usePathname()
  const navItems = footer?.navItems || []

  return (
    <footer className={noHeaderFooterUrls.includes(pathname) ? classes.hide : ''}>
      <Gutter>
        <ul className={classes.inclusions}>
          {inclusions.map(inclusion => (
            <li key={inclusion.title}>
              <Image
                src={inclusion.icon}
                alt={inclusion.title}
                width={36}
                height={36}
                className={classes.icon}
              />

              <h5 className={classes.title}>{inclusion.title}</h5>
              <p>{inclusion.description}</p>
            </li>
          ))}
        </ul>
      </Gutter>

      <div className={classes.footer}>
        <Gutter>
          <div className={classes.wrap}>
            <Link href="/">
              <Image src="/logo-white.svg" alt="logo" width={170} height={50} />
            </Link>

            <p>{footer?.copyright}</p>

            <div className={classes.socialLinks}>
              {navItems.map(item => {
                // PHASE 13H: narrowed from the full `payload-types.ts` `Media` —
                // only `.url` is read here (passed straight to `next/image`'s
                // `src`, never the `Media` display component).
                // PHASE 13K: `item.link.icon` is now typed `string |
                // StorefrontMediaItem` (via `StorefrontFooter` ->
                // `StorefrontNavItem` -> `StorefrontCMSLink`, which keeps the
                // same `string | Media`-shaped union `payload-types.ts` and
                // `NativeCMSLink` both use for an unresolved-vs-populated
                // relation — see storefront.ts's comment on `icon`). The cast
                // below is unchanged from Phase 13H: this field is always
                // populated (an object) by the time it reaches this
                // component in practice, never the bare id string.
                const icon = item?.link?.icon as StorefrontMediaItem | undefined

                return (
                  <Button
                    key={item.link.label}
                    el="link"
                    href={item.link.url}
                    newTab={true}
                    className={classes.socialLinkItem}
                  >
                    <Image
                      src={icon?.url}
                      alt={item.link.label}
                      width={24}
                      height={24}
                      className={classes.socialIcon}
                    />
                  </Button>
                )
              })}
            </div>
          </div>
        </Gutter>
      </div>
    </footer>
  )
}

export default FooterComponent
