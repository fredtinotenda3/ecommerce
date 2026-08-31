import React from 'react'
import { Metadata } from 'next'
import { Jost } from 'next/font/google'

import { isNativeAdminEnabled } from './_api/adminFlag'
import { AdminBar } from './_components/AdminBar'
import { Footer } from './_components/Footer'
import { Header } from './_components/Header'
import { Providers } from './_providers'
import { InitTheme } from './_providers/Theme/InitTheme'
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
          {/* PHASE 13A: nativeAdminEnabled is resolved server-side here
              (isNativeAdminEnabled() reads USE_NATIVE_ADMIN, not
              NEXT_PUBLIC_-prefixed) and passed down as a plain boolean
              prop — AdminBar itself is a client component and has no
              other way to see this flag. Default off, so this line is a
              no-op change for the flag-off path. */}
          <AdminBar nativeAdminEnabled={isNativeAdminEnabled()} />
          {/* @ts-expect-error */}
          <Header />
          <main className="main">{children}</main>
          {/* @ts-expect-error */}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'https://payloadcms.com'),
  twitter: {
    card: 'summary_large_image',
    creator: '@payloadcms',
  },
  openGraph: mergeOpenGraph(),
}
