/** @type {import('next').NextConfig} */
const ContentSecurityPolicy = require('./csp')
const redirectsFn = require('./redirects')

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [
      'localhost',
      process.env.NEXT_PUBLIC_SERVER_URL
        ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname
        : '',
    ].filter(Boolean),
  },
  redirects: redirectsFn,
  async headers() {
    const headers = []

    if (!process.env.NEXT_PUBLIC_IS_LIVE) {
      headers.push({
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex',
          },
        ],
        source: '/:path*',
      })
    }

    headers.push({
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: ContentSecurityPolicy,
        },
      ],
    })

    return headers
  },
}

module.exports = nextConfig
