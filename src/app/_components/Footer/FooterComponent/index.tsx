'use client'

// src/app/_components/Footer/FooterComponent/index.tsx
//
// Site footer: the four promises, link columns, contact details, social
// links and the copyright line.
//
// Link columns and contact details come from `constants/brand.ts`; social
// links prefer whatever is configured in the Footer global and fall back
// to the brand defaults, so the footer is never empty on a fresh install.

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { StorefrontFooter, StorefrontMediaItem } from '../../../_types/storefront'
import { noHeaderFooterUrls } from '../../../constants'
import {
  CONTACT,
  FOOTER_LINK_GROUPS,
  INCLUSIONS,
  SITE_NAME,
  SITE_TAGLINE,
  SOCIAL_LINKS,
} from '../../../constants/brand'
import { Gutter } from '../../Gutter'
import { Logo } from '../../Logo'
import { NewsletterForm } from '../../NewsletterForm'

import classes from './index.module.scss'

const FooterComponent = ({ footer }: { footer: StorefrontFooter | null }) => {
  const pathname = usePathname()

  if (noHeaderFooterUrls.includes(pathname)) return null

  const cmsSocial = (footer?.navItems || [])
    .map(item => {
      const icon = item?.link?.icon as StorefrontMediaItem | undefined
      return {
        label: item.link.label ?? 'Social',
        href: item.link.url ?? '#',
        icon: icon?.url ?? null,
      }
    })
    .filter(entry => entry.icon)

  const socialLinks = cmsSocial.length > 0 ? cmsSocial : SOCIAL_LINKS
  const copyright =
    footer?.copyright || `© ${new Date().getFullYear()} ${SITE_NAME}. All rights reserved.`

  return (
    <footer className={classes.footer}>
      <Gutter>
        <ul className={classes.inclusions}>
          {INCLUSIONS.map(inclusion => (
            <li key={inclusion.title}>
              <Image
                src={inclusion.icon}
                alt=""
                width={32}
                height={32}
                className={classes.inclusionIcon}
              />
              <div>
                <h3 className={classes.inclusionTitle}>{inclusion.title}</h3>
                <p className={classes.inclusionCopy}>{inclusion.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </Gutter>

      <div className={classes.main}>
        <Gutter>
          <div className={classes.columns}>
            <div className={classes.brandColumn}>
              <Link href="/" aria-label={`${SITE_NAME} home`}>
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

            {FOOTER_LINK_GROUPS.map(group => (
              <nav key={group.title} className={classes.linkColumn} aria-label={group.title}>
                <h3 className={classes.columnTitle}>{group.title}</h3>
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

            <div className={classes.newsletterColumn}>
              <h3 className={classes.columnTitle}>Stay in the loop</h3>
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
                  <Image
                    src={social.icon as string}
                    alt=""
                    width={20}
                    height={20}
                    className={classes.socialIcon}
                  />
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
