// src/app/_api/paynowCheckout.ts
//
// DB- and provider-wired entry points for the Paynow checkout services.
// `PaynowCheckoutService.ts` and `PaynowCallbackService.ts` take repository
// and provider INTERFACES so they can be unit tested with fakes; this file
// supplies the concrete Mongo repositories and the real `PaynowProvider`
// for the route handlers to call.
//
// This is the only module in the checkout path that touches both the real
// database and the real Paynow API.

import { getDbConnection } from '../../lib/db/connection'
import type { CartItem, Order } from '../../lib/domain/types'
import { PaynowProvider } from '../../lib/payments/PaynowProvider'
import { MongoOrderRepository } from '../../lib/repositories/OrderRepository'
import { MongoPaymentRepository } from '../../lib/repositories/PaymentRepository'
import { MongoProductRepository } from '../../lib/repositories/ProductRepository'
import { MongoUserRepository } from '../../lib/repositories/UserRepository'
import { OrderService } from '../../lib/services/OrderService'
import { PaymentService } from '../../lib/services/PaymentService'
import {
  type PaynowCallbackResult,
  processPaynowCallback as runPaynowCallback,
} from '../../lib/services/PaynowCallbackService'
import {
  initiatePaynowCheckout as runPaynowCheckout,
  type InitiatePaynowCheckoutInput,
  type PaynowCheckoutResult,
} from '../../lib/services/PaynowCheckoutService'

// The PaynowProvider itself holds no request-scoped state (config is
// read once at construction, from `loadPaynowConfig()` /
// `process.env`) — safe to build once and reuse across requests/module
// reloads, same rationale as caching the DB connection in connection.ts.
let cachedProvider: PaynowProvider | null = null
const getProvider = (): PaynowProvider => {
  if (!cachedProvider) {
    cachedProvider = new PaynowProvider()
  }
  return cachedProvider
}

interface PaynowCheckoutWiring {
  orderRepository: MongoOrderRepository
  paymentRepository: MongoPaymentRepository
  productRepository: MongoProductRepository
  userRepository: MongoUserRepository
  provider: PaynowProvider
  orderService: OrderService
  paymentService: PaymentService
}

const getWiring = async (): Promise<PaynowCheckoutWiring> => {
  const connection = await getDbConnection()
  const orderRepository = new MongoOrderRepository(connection)
  const paymentRepository = new MongoPaymentRepository(connection)
  const productRepository = new MongoProductRepository(connection)
  const userRepository = new MongoUserRepository(connection)
  const provider = getProvider()

  return {
    orderRepository,
    paymentRepository,
    productRepository,
    userRepository,
    provider,
    orderService: new OrderService(orderRepository, productRepository),
    paymentService: new PaymentService(paymentRepository, provider),
  }
}

export const initiatePaynowCheckout = async (
  input: InitiatePaynowCheckoutInput,
): Promise<PaynowCheckoutResult> => {
  const { orderService, paymentService } = await getWiring()
  return runPaynowCheckout(input, { orderService, paymentService })
}

export const processPaynowCallback = async (
  rawPayload: unknown,
): Promise<PaynowCallbackResult> => {
  const { provider, paymentRepository, orderRepository, userRepository } = await getWiring()
  return runPaynowCallback(rawPayload, {
    provider,
    paymentRepository,
    orderRepository,
    userRepository,
  })
}

/** The ONLY source of cart items the checkout-initiation route handler
 * is allowed to use — read fresh from the database for the given
 * customer, never accepted from the request body. */
export const getCustomerCartItems = async (customerId: string): Promise<CartItem[]> => {
  const { userRepository } = await getWiring()
  const user = await userRepository.getById(customerId)
  return user?.cart ?? []
}

/** Used by the GET return-URL route to redirect the customer to an
 * order-status page — READ ONLY, never mutates anything. See the return
 * route handler for why this must never be used to mark a payment as
 * successful. */
export const getOrderByOrderNumber = async (orderNumber: string): Promise<Order | null> => {
  const { orderRepository } = await getWiring()
  return orderRepository.getByOrderNumber(orderNumber)
}
