import type { PayloadHandler } from 'payload/config'
import type { PayloadRequest } from 'payload/types'
import Stripe from 'stripe'

import { checkRole } from '../collections/Users/checkRole'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-08-01',
})

const logs = process.env.LOGS_STRIPE_PROXY === '1'

// GET /api/stripe/prices?product=prod_xxx
export const pricesProxy: PayloadHandler = async (req: PayloadRequest, res) => {
  if (!req.user || !checkRole(['admin'], req.user)) {
    if (logs) req.payload.logger.error({ err: `You are not authorized to access prices` })
    res.status(401).json({ error: 'You are not authorized to access prices' })
    return
  }

  const productId = req.query.product as string

  if (!productId) {
    res.status(400).json({ error: 'Product ID is required' })
    return
  }

  try {
    const prices = await stripe.prices.list({
      product: productId,
      limit: 100,
      active: true,
    })

    res.status(200).json(prices)
  } catch (error: unknown) {
    if (logs) req.payload.logger.error({ err: `Error using Stripe API: ${error}` })
    res.status(500).json({ error: `Error using Stripe API: ${error}` })
  }
}