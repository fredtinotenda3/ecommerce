const path = require('path')

const redirectsFn = async () => {
  const internetExplorerRedirect = {
    source: '/:path((?!ie-incompatible.html$).*)',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)',
      },
    ],
    permanent: false,
    destination: '/ie-incompatible.html',
  }

  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL

  if (!serverURL) {
    console.warn('NEXT_PUBLIC_SERVER_URL is not defined, skipping dynamic redirects')
    return [internetExplorerRedirect]
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    let redirectsRes

    try {
      redirectsRes = await fetch(`${serverURL}/api/redirects?limit=1000&depth=1`, {
        signal: controller.signal,
      })
    } catch (fetchError) {
      return [internetExplorerRedirect]
    } finally {
      clearTimeout(timeoutId)
    }

    if (!redirectsRes.ok) {
      return [internetExplorerRedirect]
    }

    const contentType = redirectsRes.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return [internetExplorerRedirect]
    }

    const redirectsData = await redirectsRes.json()
    const { docs } = redirectsData

    const dynamicRedirects = []

    if (docs && Array.isArray(docs)) {
      docs.forEach(doc => {
        const { from, to: { type, url, reference } = {} } = doc

        if (!from) return

        let source = from.replace(serverURL, '').split('?')[0].toLowerCase()

        if (source.endsWith('/')) {
          source = source.slice(0, -1)
        }

        if (!source.startsWith('/')) return

        let destination = '/'

        if (type === 'custom' && url) {
          destination = url.replace(serverURL, '')
        }

        if (
          type === 'reference' &&
          typeof reference.value === 'object' &&
          reference?.value?._status === 'published'
        ) {
          destination = `${reference.relationTo !== 'pages' ? `/${reference.relationTo}` : ''}/${
            reference.value.slug
          }`
        }

        if (destination && source !== destination) {
          dynamicRedirects.push({
            source,
            destination,
            permanent: true,
          })
        }
      })
    }

    return [internetExplorerRedirect, ...dynamicRedirects]
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Redirects API not available during build, using defaults only')
    } else {
      console.error(`Error configuring redirects: ${error}`)
    }

    return [internetExplorerRedirect]
  }
}

module.exports = redirectsFn
