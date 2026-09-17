'use client'

// src/app/_components/Footer/FooterComponent/index.tsx
//
// Site footer: brand, contact, link columns, newsletter and the legal line.
//
// ADMIN-MANAGED CONTENT. Every piece of business content here — the site
// name/tagline, the contact details, the footer's link columns and the
// social links — comes from the Settings/Footer globals (`/admin/globals`),
// not from anything hardcoded in source. Each field falls back to
// `siteDefaults.ts` independently when unset, so a fresh install (or an
// operator who has only filled in some fields) still renders a complete,
// coherent footer — same treatment `Home/Hero` already gives its own
// content.
//
// Two things worth explaining beyond that:
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
//      image. SVG can carry script; that flag is not free. The icon is
//      selected by `platform` (an enum), never by matching a free-typed
//      label string, so a social link can never silently lose its glyph.

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  DEFAULT_CONTACT,
  DEFAULT_FOOTER_LINK_GROUPS,
  DEFAULT_SITE_NAME,
  DEFAULT_SITE_TAGLINE,
  DEFAULT_SOCIAL_LINKS,
} from '../../../../lib/domain/siteDefaults'
import { StorefrontFooter, StorefrontSettingsLike, StorefrontSocialPlatform } from '../../../_types/storefront'
import { noHeaderFooterUrls } from '../../../constants'
import { Gutter } from '../../Gutter'
import { Logo } from '../../Logo'
import { NewsletterForm } from '../../NewsletterForm'

import classes from './index.module.scss'

const SOCIAL_LABELS: Record<StorefrontSocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  x: 'X',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  other: 'website',
}

const SOCIAL_ICONS: Record<StorefrontSocialPlatform, React.ReactNode> = {
  instagram: (
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
  facebook: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.87.24-1.46 1.49-1.46H16.6V4.46A20 20 0 0 0 14.28 4.3c-2.3 0-3.88 1.4-3.88 3.98V10.5H7.8v3h2.6V21Z" />
    </svg>
  ),
  x: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.2 3h3.1l-6.77 7.74L21.5 21h-6.23l-4.88-6.38L4.8 21H1.7l7.24-8.28L2 3h6.39l4.41 5.83Zm-1.09 16.13h1.72L7.96 4.78H6.11Z" />
    </svg>
  ),
  whatsapp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.02 2.5c-5.26 0-9.53 4.27-9.53 9.53 0 1.68.44 3.31 1.28 4.75L2.5 21.5l4.86-1.24a9.5 9.5 0 0 0 4.66 1.19h.01c5.26 0 9.53-4.27 9.53-9.53 0-2.55-.99-4.94-2.79-6.74a9.47 9.47 0 0 0-6.75-2.68Zm0 17.44h-.01a7.9 7.9 0 0 1-4.02-1.1l-.29-.17-3.02.79.8-2.94-.19-.3a7.9 7.9 0 0 1-1.22-4.19c0-4.38 3.57-7.94 7.96-7.94a7.9 7.9 0 0 1 5.62 2.33 7.87 7.87 0 0 1 2.33 5.62c0 4.38-3.57 7.9-7.96 7.9Zm4.36-5.93c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1-.37-1.9-1.17-.7-.62-1.18-1.39-1.31-1.63-.14-.24-.01-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.4-.14-.01-.3-.01-.46-.01a.9.9 0 0 0-.64.3c-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  ),
  tiktok: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14.5 2h2.7c.18 1.5.98 2.86 2.27 3.7 1 .66 2.15.98 3.53.98v2.9c-1.6.03-3.1-.44-4.4-1.3v6.94c0 3.6-2.9 6.53-6.55 6.53A6.55 6.55 0 0 1 5.5 15.2c0-3.62 2.9-6.55 6.55-6.55.34 0 .67.03 1 .08v3.06a3.5 3.5 0 0 0-1-.15 3.55 3.55 0 1 0 3.55 3.56V2Z" />
    </svg>
  ),
  youtube: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="5.5" width="20" height="13" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" />
    </svg>
  ),
  linkedin: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="7.3" cy="7.6" r="1.4" />
      <path d="M6 10.8h2.6V18H6zM10.3 10.8h2.5v1c.5-.7 1.3-1.2 2.5-1.2 2 0 3 1.3 3 3.7V18h-2.6v-3.3c0-1-.4-1.6-1.3-1.6-.9 0-1.4.6-1.4 1.6V18h-2.6v-7.2Z" />
    </svg>
  ),
  other: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10 13.5a4 4 0 0 0 5.66 0l2.6-2.6a4 4 0 1 0-5.66-5.66l-1 1M14 10.5a4 4 0 0 0-5.66 0l-2.6 2.6a4 4 0 1 0 5.66 5.66l1-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
}

const FooterComponent = ({
  footer,
  settings,
}: {
  footer: StorefrontFooter | null
  settings: StorefrontSettingsLike | null
}) => {
  const pathname = usePathname()

  if (noHeaderFooterUrls.includes(pathname)) return null

  const siteName = settings?.siteName || DEFAULT_SITE_NAME
  const siteTagline = settings?.siteTagline || DEFAULT_SITE_TAGLINE
  const contactEmail = settings?.contactEmail || DEFAULT_CONTACT.email
  const contactPhone = settings?.contactPhone || DEFAULT_CONTACT.phone
  const hours = settings?.hours || DEFAULT_CONTACT.hours
  const addressLines =
    settings?.addressLines && settings.addressLines.length > 0
      ? settings.addressLines
      : DEFAULT_CONTACT.addressLines
  const socialLinks =
    settings?.socialLinks && settings.socialLinks.length > 0 ? settings.socialLinks : DEFAULT_SOCIAL_LINKS
  const linkGroups =
    footer?.linkGroups && footer.linkGroups.length > 0 ? footer.linkGroups : DEFAULT_FOOTER_LINK_GROUPS
  const copyright = footer?.copyright || `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`
  const backgroundImageUrl = settings?.brandBackgroundImage?.url

  return (
    <footer className={classes.footer}>
      <div className={classes.main}>
        {/* The admin-configured "electric-blue circuit" backdrop (Settings
            -> Brand background image), faded along the footer's top edge.
            Decorative only — falls back to a plain gradient wash (see the
            stylesheet) when no image has been configured. */}
        <div
          className={classes.circuit}
          aria-hidden="true"
          style={backgroundImageUrl ? { backgroundImage: `url(${backgroundImageUrl})` } : undefined}
        />
        <div className={classes.circuitScrim} aria-hidden="true" />

        <Gutter>
          <div className={classes.columns}>
            <div className={classes.brandColumn}>
              <Link href="/" aria-label={`${siteName} home`} className={classes.brandLink}>
                <Logo variant="dark" />
              </Link>
              <p className={classes.tagline}>{siteTagline}.</p>

              <address className={classes.contact}>
                {addressLines.map(line => (
                  <span key={line}>{line}</span>
                ))}
                <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                <a href={`tel:${contactPhone.replace(/\s/g, '')}`}>{contactPhone}</a>
                <span className={classes.hours}>{hours}</span>
              </address>
            </div>

            <div className={classes.linkColumns}>
              {linkGroups.map(group => (
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
              {socialLinks.map(social => {
                const label = social.platform === 'other' ? social.label || 'website' : SOCIAL_LABELS[social.platform]
                return (
                  <a
                    key={social.url}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={classes.socialLinkItem}
                    aria-label={`${siteName} on ${label}`}
                  >
                    {SOCIAL_ICONS[social.platform]}
                  </a>
                )
              })}
            </div>

            <p className={classes.payments}>Secure payments by Paynow</p>
          </div>
        </Gutter>
      </div>
    </footer>
  )
}

export default FooterComponent
