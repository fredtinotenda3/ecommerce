// src/lib/services/AdminQueryService.ts
//
// read-only query/shaping functions backing the native admin
// area's listing and detail views. Orchestration only (mirrors
// AuthService.ts / fetchProductNative.ts's `buildStorefrontProduct`
// split): every function here takes repository INTERFACES, never
// concrete Mongo classes, so this whole file is unit-testable with the
// existing fake-repository pattern (tests/fakes/*) and no database. DB
// wiring lives in src/app/_api/adminQueries.ts.
//
// READ-ONLY: nothing in this file may call a repository create/update/
// delete method. Some of the underlying repository interfaces (e.g.
// ProductRepository, CategoryRepository) also expose write methods for
// other, non-admin callers — this file simply never calls them.
//
// Every shape returned here is deliberately built field-by-field (never
// spreading a raw AuthUserRecord or User doc) so it's structurally
// impossible to accidentally leak password/auth-internal fields
// (hash/salt/loginAttempts/lockUntil/resetPasswordToken/
// resetPasswordExpiration) into an admin page — those fields don't even
// exist on the `User` domain type this file reads from; only
// `AuthUserRepository`/`AuthUserRecord` (a separate repository, see its
// own header comment) carries them, and this file never imports that
// repository at all.

import type { Order, OrderStatus, Page, Payment, Product, Role, User } from '../domain/types'
import type { CategoryRepository } from '../repositories/CategoryRepository'
import type { MediaRepository } from '../repositories/MediaRepository'
import type { OrderListFilter, OrderRepository } from '../repositories/OrderRepository'
import type { PageRepository } from '../repositories/PageRepository'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import type { ProductRepository } from '../repositories/ProductRepository'
import type { UserListFilter, UserRepository } from '../repositories/UserRepository'

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface AdminProductListRow {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  price: number | null
  currency: string | null
  categoryIds: string[]
  updatedAt: Date
}

export const listAdminProducts = async (
  deps: { productRepository: ProductRepository },
  filter?: { status?: 'draft' | 'published'; limit?: number; page?: number },
): Promise<AdminProductListRow[]> => {
  const products = await deps.productRepository.list(filter)
  return products.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    price: p.price,
    currency: p.currency,
    categoryIds: p.categories,
    updatedAt: p.updatedAt,
  }))
}

export interface AdminProductDetail {
  product: Product
  categories: Array<{ id: string; title: string }>
}

/** Full product info via the existing `ProductRepository` — the
 * `Product` domain type has no password/auth-internal fields to begin
 * with (those live only on `User`/`AuthUserRecord`), so nothing needs to
 * be stripped here; this just additionally resolves category titles for
 * display. */
export const getAdminProductDetail = async (
  id: string,
  deps: { productRepository: ProductRepository; categoryRepository: CategoryRepository },
): Promise<AdminProductDetail | null> => {
  const product = await deps.productRepository.getById(id)
  if (!product) return null

  const categories = (
    await Promise.all(product.categories.map(catId => deps.categoryRepository.getById(catId)))
  )
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map(c => ({ id: c.id, title: c.title }))

  return { product, categories }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface AdminCategoryRow {
  id: string
  title: string
  parentId: string | null
  parentTitle: string | null
  mediaId: string | null
  createdAt: Date
  updatedAt: Date
}

export const listAdminCategories = async (deps: {
  categoryRepository: CategoryRepository
}): Promise<AdminCategoryRow[]> => {
  const categories = await deps.categoryRepository.list()
  const byId = new Map(categories.map(c => [c.id, c]))

  return categories.map(c => ({
    id: c.id,
    title: c.title,
    parentId: c.parentId,
    parentTitle: c.parentId ? byId.get(c.parentId)?.title ?? null : null,
    mediaId: c.mediaId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }))
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface AdminOrderListRow {
  id: string
  orderNumber: string
  customerId: string
  customerEmail: string | null
  total: number
  currency: string
  status: OrderStatus
  createdAt: Date
}

export const listAdminOrders = async (
  deps: { orderRepository: OrderRepository; userRepository: UserRepository },
  filter?: OrderListFilter,
): Promise<AdminOrderListRow[]> => {
  const orders = await deps.orderRepository.list(filter)

  return Promise.all(
    orders.map(async order => {
      const customer = order.customerId ? await deps.userRepository.getById(order.customerId) : null
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerEmail: customer?.email ?? null,
        total: order.total,
        currency: order.currency,
        status: order.status,
        createdAt: order.createdAt,
      }
    }),
  )
}

export interface AdminOrderDetail {
  order: Order
  customer: { id: string; name: string | null; email: string } | null
  payments: Payment[]
}

export const getAdminOrderDetail = async (
  id: string,
  deps: {
    orderRepository: OrderRepository
    userRepository: UserRepository
    paymentRepository: PaymentRepository
  },
): Promise<AdminOrderDetail | null> => {
  const order = await deps.orderRepository.getById(id)
  if (!order) return null

  const customer = order.customerId ? await deps.userRepository.getById(order.customerId) : null
  const payments = await deps.paymentRepository.getByOrderId(order.id)

  return {
    order,
    customer: customer ? { id: customer.id, name: customer.name, email: customer.email } : null,
    payments,
  }
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface AdminCustomerListRow {
  id: string
  name: string | null
  email: string
  roles: Role[]
  createdAt: Date
}

/** Reads via the storefront-safe `UserRepository` (not
 * `AuthUserRepository`) — its `User` domain type never carries
 * `hash`/`salt`/`loginAttempts`/`lockUntil`/reset-token fields, so this
 * row shape is safe to render as-is. */
export const listAdminCustomers = async (
  deps: { userRepository: UserRepository },
  filter?: UserListFilter,
): Promise<AdminCustomerListRow[]> => {
  const users = await deps.userRepository.list(filter)
  return users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles,
    createdAt: u.createdAt,
  }))
}

export interface AdminCustomerDetail {
  customer: Omit<User, 'cart' | 'purchases' | 'legacyStripeCustomerId'>
  orders: Order[]
  purchases: Array<{ id: string; title: string; slug: string }>
}

export const getAdminCustomerDetail = async (
  id: string,
  deps: {
    userRepository: UserRepository
    orderRepository: OrderRepository
    productRepository: ProductRepository
  },
): Promise<AdminCustomerDetail | null> => {
  const user = await deps.userRepository.getById(id)
  if (!user) return null

  const orders = await deps.orderRepository.getByCustomer(id)

  const purchases = (
    await Promise.all(user.purchases.map(productId => deps.productRepository.getById(productId)))
  )
    .filter((p): p is Product => Boolean(p))
    .map(p => ({ id: p.id, title: p.title, slug: p.slug }))

  return {
    customer: {
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    orders,
    purchases,
  }
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface AdminPageRow {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published'
  updatedAt: Date
}

export const listAdminPages = async (deps: {
  pageRepository: PageRepository
}): Promise<AdminPageRow[]> => {
  const pages = await deps.pageRepository.list()
  return pages.map(p => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    updatedAt: p.updatedAt,
  }))
}

export const getAdminPageDetail = async (
  id: string,
  deps: { pageRepository: PageRepository },
): Promise<Page | null> => deps.pageRepository.getById(id)

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export interface AdminMediaRow {
  id: string
  alt: string
  filename: string | null
  mimeType: string | null
  url: string | null
  width: number | null
  height: number | null
  createdAt: Date
}

export const listAdminMedia = async (
  deps: { mediaRepository: MediaRepository },
  limit?: number,
): Promise<AdminMediaRow[]> => {
  const media = await deps.mediaRepository.list(limit)
  return media.map(m => ({
    id: m.id,
    alt: m.alt,
    filename: m.filename,
    mimeType: m.mimeType,
    url: m.url,
    width: m.width,
    height: m.height,
    createdAt: m.createdAt,
  }))
}
