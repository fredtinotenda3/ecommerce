// src/app/_api/paynowCheckout.ts
//
// PHASE 8 — DB/provider-wired entry points for the Paynow checkout
// orchestration services. Mirrors the fetchProductNative.ts /
// authNative.ts / adminQueries.ts split: `PaynowCheckoutService.ts` and
// `PaynowCallbackService.ts` take repository/provider INTERFACES for
// unit testing (see tests/paynowCheckoutService.test.ts,
// tests/paynowCallbackService.test.ts), and this file supplies the
// concrete `Mongo*Repository` classes + the real `PaynowProvider` wired
// to the actual DB connection / Paynow credentials for the Phase 8
// route handlers to call.
//
// This is the ONLY file in Phase 8 that reads/writes the real database
// or talks to the real Paynow API — every other new file in this phase
// is either a pure orchestrator (testable with fakes) or a thin route
// handler that delegates here.

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
  processPaynowCallback,
} from '../../lib/services/PaynowCallbackService'
import {
  initiatePaynowCheckout,
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

export const initiatePaynowCheckoutNative = async (
  input: InitiatePaynowCheckoutInput,
): Promise<PaynowCheckoutResult> => {
  const { orderService, paymentService } = await getWiring()
  return initiatePaynowCheckout(input, { orderService, paymentService })
}

export const processPaynowCallbackNative = async (
  rawPayload: unknown,
): Promise<PaynowCallbackResult> => {
  const { provider, paymentRepository, orderRepository, userRepository } = await getWiring()
  return processPaynowCallback(rawPayload, {
    provider,
    paymentRepository,
    orderRepository,
    userRepository,
  })
}

/** The ONLY source of cart items the checkout-initiation route handler
 * is allowed to use — read fresh from the database for the given
 * customer, never accepted from the request body. Uses the native
 * `UserRepository` (same underlying `users.cart.items` Payload's own
 * cart UI already writes — see the Phase 1 connection.ts note that both
 * Mongoose connections point at the same physical database) rather than
 * a second HTTP round-trip to Payload's own API, since a DB connection
 * is already available here and `CartItem` is exactly this repository's
 * shape. */
export const getCustomerCartItemsNative = async (customerId: string): Promise<CartItem[]> => {
  const { userRepository } = await getWiring()
  const user = await userRepository.getById(customerId)
  return user?.cart ?? []
}

/** Used by the GET return-URL route to redirect the customer to an
 * order-status page — READ ONLY, never mutates anything. See the return
 * route handler for why this must never be used to mark a payment as
 * successful. */
export const getOrderByOrderNumberNative = async (orderNumber: string): Promise<Order | null> => {
  const { orderRepository } = await getWiring()
  return orderRepository.getByOrderNumber(orderNumber)
}
