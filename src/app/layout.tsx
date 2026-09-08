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

const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-jost',
})

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <InitTheme />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  openGraph: mergeOpenGraph(),
}
