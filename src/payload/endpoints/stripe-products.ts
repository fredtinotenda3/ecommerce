import type { PayloadHandler } from 'payload/config'
import type { PayloadRequest } from 'payload/types'

// Dynamic import for Stripe to avoid client-side bundling issues
const getStripe = async (): Promise<any> => {
  const Stripe = (await import('stripe')).default
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2022-08-01',
  })
}

export const stripeProductsHandler: PayloadHandler = async (req: PayloadRequest, res) => {
  console.log('=== Stripe Products Endpoint Called ===')

  if (!req.user) {
    console.log('No user authenticated')
    return res.status(401).json({ error: 'Unauthorized - Please log in' })
  }

  const isAdmin = req.user.roles?.includes('admin')
  if (!isAdmin) {
    console.log('User is not admin:', req.user.roles)
    return res.status(403).json({ error: 'Forbidden - Admin access required' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set')
    return res.status(500).json({ error: 'Stripe configuration is missing' })
  }

  try {
    console.log('Fetching products from Stripe...')

    const stripe = await getStripe()

    const products = await stripe.products.list({
      limit: 100,
      active: true,
    })

    console.log(`Found ${products.data.length} products in Stripe`)

    return res.status(200).json({
      success: true,
      data: products.data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        default_price: product.default_price,
      })),
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error('Error fetching Stripe products:', errorMessage)
    return res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}
