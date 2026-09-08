'use client'

// src/app/_components/Footer/FooterComponent/index.tsx
//
// Site footer: brand, contact, link columns, newsletter and the legal line.
//
// Two changes worth explaining:
//
//   1. The four promises (free delivery, returns, support, Paynow) used to
//      repeat here. They now have a proper band on the homepage
//      (`Home/ValueProps`), and running them twice on one page made the
//      footer read as filler. The footer keeps the links and the contact
//      details, which is what a footer is actually for.
//
//   2. Social icons are inline SVG rather than <Image> pointing at SVG
//      files. Inline means they inherit `currentColor`, so they work in
//      both themes and against the dark footer without a second asset —
//      and it avoids needing `dangerouslyAllowSVG` in next.config.js, which
//      would let any SVG in the media library be served as an optimised
//      image. SVG can carry script; that flag is not free.
//
// Social links still come from the Footer global when an editor has
// configured them, falling back to the brand defaults so the footer is
// never empty on a fresh install.

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { StorefrontFooter } from '../../../_types/storefront'
import { noHeaderFooterUrls } from '../../../constants'
import {
  CONTACT,
  FOOTER_LINK_GROUPS,
  SITE_NAME,
  SITE_TAGLINE,
  SOCIAL_LINKS,
} from '../../../constants/brand'
import { Gutter } from '../../Gutter'
import { Logo } from '../../Logo'
import { NewsletterForm } from '../../NewsletterForm'

import classes from './index.module.scss'

/** Keyed on the labels used in `SOCIAL_LINKS`. A network we have no glyph
 * for falls back to a generic link mark rather than rendering nothing. */
const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  Instagram: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.75"
        y="2.75"
        width="18.5"
        height="18.5"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" />
    </svg>
  ),
  Facebook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.49-1.46H16.6V4.46A20 20 0 0 0 14.28 4.3c-2.3 0-3.88 1.4-3.88 3.98V10.5H7.8v3h2.6V21Z" />
    </svg>
  ),
  Twitter: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.2 3h3.1l-6.77 7.74L21.5 21h-6.23l-4.88-6.38L4.8 21H1.7l7.24-8.28L2 3h6.39l4.41 5.83Zm-1.09 16.13h1.72L7.96 4.78H6.11Z" />
    </svg>
  ),
}

const GenericSocialIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M10 13.5a4 4 0 0 0 5.66 0l2.6-2.6a4 4 0 1 0-5.66-5.66l-1 1M14 10.5a4 4 0 0 0-5.66 0l-2.6 2.6a4 4 0 1 0 5.66 5.66l1-1"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
)

const FooterComponent = ({ footer }: { footer: StorefrontFooter | null }) => {
  const pathname = usePathname()

  if (noHeaderFooterUrls.includes(pathname)) return null

  const cmsSocial = (footer?.navItems || [])
    .map(item => ({
      label: item.link.label ?? 'Social',
      href: item.link.url ?? '#',
    }))
    .filter(entry => entry.href !== '#')

  const socialLinks = cmsSocial.length > 0 ? cmsSocial : SOCIAL_LINKS
  const copyright =
    footer?.copyright || `© ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.`

  return (
    <footer className={classes.footer}>
      <div className={classes.main}>
        <Gutter>
          <div className={classes.columns}>
            <div className={classes.brandColumn}>
              <Link href="/" aria-label={`${SITE_NAME} home`} className={classes.brandLink}>
                <Logo variant="dark" />
              </Link>
              <p className={classes.tagline}>{SITE_TAGLINE}.</p>

              <address className={classes.contact}>
                {CONTACT.addressLines.map(line => (
                  <span key={line}>{line}</span>
                ))}
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                <a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a>
                <span className={classes.hours}>{CONTACT.hours}</span>
              </address>
            </div>

            <div className={classes.linkColumns}>
              {FOOTER_LINK_GROUPS.map(group => (
                <nav key={group.title} className={classes.linkColumn} aria-label={group.title}>
                  <h2 className={classes.columnTitle}>{group.title}</h2>
                  <ul>
                    {group.links.map(link => (
                      <li key={link.href}>
                        <Link href={link.href} className={classes.footerLink}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>

            <div className={classes.newsletterColumn}>
              <h2 className={classes.columnTitle}>Stay in the loop</h2>
              <p className={classes.newsletterCopy}>
                New arrivals and genuine price drops. One email a month, no noise.
              </p>
              <NewsletterForm variant="dark" />
            </div>
          </div>

          <div className={classes.bottom}>
            <p className={classes.copyright}>{copyright}</p>

            <div className={classes.socialLinks}>
              {socialLinks.map(social => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={classes.socialLinkItem}
                  aria-label={`${SITE_NAME} on ${social.label}`}
                >
                  {SOCIAL_ICONS[social.label] ?? GenericSocialIcon}
                </a>
              ))}
            </div>

            <p className={classes.payments}>Secure payments by Paynow</p>
          </div>
        </Gutter>
      </div>
    </footer>
  )
}

export default FooterComponent
