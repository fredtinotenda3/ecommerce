import React from 'react'
import { Metadata } from 'next'
import { Jost } from 'next/font/google'

import { fetchSettings } from './_api/fetchGlobals'
import { BackToTop } from './_components/BackToTop'
import { BrandBackdrop } from './_components/BrandBackdrop'
import { Footer } from './_components/Footer'
import { Header } from './_components/Header'
import { StorefrontSettingsLike } from './_types/storefront'
import { Providers } from './_providers'
import { InitTheme } from './_providers/Theme/InitTheme'
import { DEFAULT_SITE_DESCRIPTION, DEFAULT_SITE_NAME, DEFAULT_SITE_TAGLINE } from '../lib/domain/siteDefaults'
import { mergeOpenGraph, siteInfoFromSettings } from './_utilities/mergeOpenGraph'

import './_css/app.scss'

/** Best-effort: a failed read here should degrade to the built-in site
 * defaults, never break every page's `<head>` or the decorative backdrop.
 *
 * Called independently from both `RootLayout` and `generateMetadata` below
 * (two reads per request, not deduplicated) rather than through React's
 * `cache()` — this project's pinned React 18.2 does not export `cache` (it
 * shipped as part of React's canary/RSC-only surface and was never
 * backported to the stable 18.x line this app depends on; declaring it
 * anyway would pass a lint-only `tsc` check but throw at runtime with
 * "cache is not a function"). Two independent Settings reads is the same
 * trade-off every other page in this app already makes on purpose (see
 * `(pages)/products/[slug]/page.tsx`'s separate `fetchProduct`/
 * `fetchSettings` try/catch blocks) — an extra fast Mongo read per request
 * is a fair price for not depending on an API this app's React version
 * does not have. */
const loadSettings = async (): Promise<StorefrontSettingsLike | null> => {
  try {
    return await fetchSettings()
  } catch (error) {
    console.error('settings read failed:', error) // eslint-disable-line no-console
    return null
  }
}

// 500 and 600 are loaded because the type scale uses them. Without the
// real weights the browser synthesises them from 400, which is what makes
// "semibold" headings look smeared rather than crisp.
// `display: 'swap'` shows fallback text immediately rather than blocking
// first paint on the font file.
const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-jost',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await loadSettings()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        {/* `@media (scripting: none)` in app.scss covers modern browsers;
            this covers the rest. The page is hidden until the theme is
            resolved, so without one of these a visitor with JavaScript off
            would see nothing at all. */}
        <noscript>
          <style>{`html{opacity:1 !important}`}</style>
        </noscript>
      </head>
      <body className={jost.variable}>
        <Providers>
          {/* Admin-configured decorative wash (Settings -> Brand background
              image). Renders nothing when unset. Placed first so it paints
              behind every positioned element that follows it in the DOM. */}
          <BrandBackdrop imageUrl={settings?.brandBackgroundImage?.url} />

          {/* First tab stop on every page: a keyboard user should not have
              to traverse the whole header to reach the content. */}
          <a href="#main-content" className="th-skip-link">
            Skip to content
          </a>

          {/* @ts-expect-error async server component */}
          <Header />
          <main id="main-content" className="main">
            {children}
          </main>
          {/* @ts-expect-error async server component */}
          <Footer />
          <BackToTop />
        </Providers>
      </body>
    </html>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await loadSettings()

  const siteName = settings?.siteName || DEFAULT_SITE_NAME
  const siteTagline = settings?.siteTagline || DEFAULT_SITE_TAGLINE
  const siteDescription = settings?.siteDescription || DEFAULT_SITE_DESCRIPTION
  const siteInfo = siteInfoFromSettings(settings, settings?.brandBackgroundImage?.url ?? null)

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
    // `%s` is filled in by each page's own title; a page that sets none
    // falls back to the default below rather than rendering a bare
    // template.
    title: {
      template: `%s | ${siteName}`,
      default: `${siteName} — ${siteTagline}`,
    },
    description: siteDescription,
    applicationName: siteName,
    // Declared through the metadata API rather than hand-written <link>
    // tags: Next then emits them in the right order and, more importantly,
    // will not silently keep a tag pointing at a file that does not exist.
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: '32x32' },
      ],
      shortcut: '/favicon.ico',
      apple: '/favicon.svg',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${siteName} — ${siteTagline}`,
      description: siteDescription,
    },
    openGraph: mergeOpenGraph(undefined, siteInfo),
  }
}
