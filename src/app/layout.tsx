import React from 'react'
import { Metadata } from 'next'
import { Jost } from 'next/font/google'

import { Footer } from './_components/Footer'
import { Header } from './_components/Header'
import { Providers } from './_providers'
import { InitTheme } from './_providers/Theme/InitTheme'
import { BackToTop } from './_components/BackToTop'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from './constants/brand'
import { mergeOpenGraph } from './_utilities/mergeOpenGraph'

import './_css/app.scss'

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
  // `%s` is filled in by each page's own title; a page that sets none falls
  // back to the default below rather than rendering a bare template.
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Declared through the metadata API rather than hand-written <link>
  // tags: Next then emits them in the right order and, more importantly,
  // will not silently keep a tag pointing at a file that does not exist.
  // `/favicon.svg` was previously linked without the file being present,
  // which produced a 404 on every page load.
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
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  openGraph: mergeOpenGraph(),
}
