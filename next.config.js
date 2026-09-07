/** @type {import('next').NextConfig} */
const ContentSecurityPolicy = require('./csp')
const redirectsFn = require('./redirects')

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  typescript: {
    // Type errors fail the build. Run `npm run typecheck` locally for the
    // same check without a full build.
    ignoreBuildErrors: false,
  },
  images: {
    domains: ['localhost', serverURL ? new URL(serverURL).hostname : ''].filter(Boolean),
  },
  redirects: redirectsFn,
  async headers() {
    const headers = []

    if (!process.env.NEXT_PUBLIC_IS_LIVE) {
      headers.push({
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex' }],
      })
    }

    headers.push({
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    })

    return headers
  },
}

module.exports = nextConfig
