// tests/AdminQueryService.test.ts
import { describe, expect, it } from 'vitest'

import {
  getAdminCustomerDetail,
  getAdminOrderDetail,
  getAdminPageDetail,
  getAdminProductDetail,
  listAdminCategories,
  listAdminCustomers,
  listAdminMedia,
  listAdminOrders,
  listAdminPages,
  listAdminProducts,
} from '../src/lib/services/AdminQueryService'
import { buildTestCategory, FakeCategoryRepository } from './fakes/FakeCategoryRepository'
import { buildTestMedia, FakeMediaRepository } from './fakes/FakeMediaRepository'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { buildTestPage, FakePageRepository } from './fakes/FakePageRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { buildTestProduct, FakeProductRepository } from './fakes/FakeProductRepository'
import { buildTestUser, FakeUserRepository } from './fakes/FakeUserRepository'
import type { Order } from '../src/lib/domain/types'

describe('AdminQueryService — products', () => {
  it('lists products with the admin-listing shape (title, slug, status, price, currency, categories, updatedAt)', async () => {
    const productRepository = new FakeProductRepository()
    productRepository.seed(
      buildTestProduct({ id: 'p1', title: 'Widget', slug: 'widget', categories: ['c1'] }),
    )

    const rows = await listAdminProducts({ productRepository })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'p1',
      title: 'Widget',
      slug: 'widget',
      status: 'published',
      price: 1999,
      currency: 'USD',
      categoryIds: ['c1'],
    })
    expect(rows[0].updatedAt).toBeInstanceOf(Date)
  })

  it('product detail resolves category titles and never exposes any user/auth field (the Product type has none)', async () => {
    const productRepository = new FakeProductRepository()
    const categoryRepository = new FakeCategoryRepository()
    categoryRepository.seed(buildTestCategory({ id: 'c1', title: 'Gadgets' }))
    productRepository.seed(buildTestProduct({ id: 'p1', categories: ['c1'] }))

    const detail = await getAdminProductDetail('p1', { productRepository, categoryRepository })

    expect(detail).not.toBeNull()
    expect(detail!.categories).toEqual([{ id: 'c1', title: 'Gadgets' }])
    expect(Object.keys(detail!.product)).not.toContain('hash')
    expect(Object.keys(detail!.product)).not.toContain('salt')
  })

  it('returns null for a missing product id', async () => {
    const productRepository = new FakeProductRepository()
    const categoryRepository = new FakeCategoryRepository()

    const detail = await getAdminProductDetail('missing', { productRepository, categoryRepository })

    expect(detail).toBeNull()
  })
})

describe('AdminQueryService — categories', () => {
  it('lists categories with resolved parent title, media, and timestamps', async () => {
    const categoryRepository = new FakeCategoryRepository()
    categoryRepository.seed(buildTestCategory({ id: 'parent', title: 'Electronics' }))
    categoryRepository.seed(
      buildTestCategory({ id: 'child', title: 'Phones', parentId: 'parent', mediaId: 'm1' }),
    )

    const rows = await listAdminCategories({ categoryRepository })
    const child = rows.find(r => r.id === 'child')

    expect(child).toMatchObject({
      title: 'Phones',
      parentId: 'parent',
      parentTitle: 'Electronics',
      mediaId: 'm1',
    })
  })

  it('leaves parentTitle null when there is no parent', async () => {
    const categoryRepository = new FakeCategoryRepository()
    categoryRepository.seed(buildTestCategory({ id: 'root', title: 'Root' }))

    const rows = await listAdminCategories({ categoryRepository })

    expect(rows[0].parentTitle).toBeNull()
  })
})

describe('AdminQueryService — orders', () => {
  const buildOrder = (overrides: Partial<Order> = {}): Order => ({
    id: 'o1',
    orderNumber: 'ORD-1',
    customerId: 'u1',
    items: [{ productId: 'p1', title: 'Widget', unitPrice: 500, currency: 'USD', quantity: 2 }],
    subtotal: 1000,
    total: 1000,
    currency: 'USD',
    status: 'PAID',
    legacyStripePaymentIntentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  it('lists orders across all customers with resolved customer email', async () => {
    const orderRepository = new FakeOrderRepository()
    const userRepository = new FakeUserRepository()
    userRepository.seed(buildTestUser({ id: 'u1', email: 'buyer@example.com' }))
    orderRepository.seed(buildOrder({ id: 'o1', customerId: 'u1' }))
    orderRepository.seed(buildOrder({ id: 'o2', customerId: 'u2', orderNumber: 'ORD-2' }))

    const rows = await listAdminOrders({ orderRepository, userRepository })

    expect(rows).toHaveLength(2)
    const withKnownCustomer = rows.find(r => r.id === 'o1')
    const withUnknownCustomer = rows.find(r => r.id === 'o2')
    expect(withKnownCustomer?.customerEmail).toBe('buyer@example.com')
    expect(withUnknownCustomer?.customerEmail).toBeNull()
  })

  it('filters orders by status when a filter is provided', async () => {
    const orderRepository = new FakeOrderRepository()
    const userRepository = new FakeUserRepository()
    orderRepository.seed(buildOrder({ id: 'o1', status: 'PAID' }))
    orderRepository.seed(buildOrder({ id: 'o2', status: 'CANCELLED', orderNumber: 'ORD-2' }))

    const rows = await listAdminOrders({ orderRepository, userRepository }, { status: 'PAID' })

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('o1')
  })

  it('order detail includes items, totals, customer info, and payment records', async () => {
    const orderRepository = new FakeOrderRepository()
    const userRepository = new FakeUserRepository()
    const paymentRepository = new FakePaymentRepository()
    userRepository.seed(buildTestUser({ id: 'u1', email: 'buyer@example.com', name: 'Buyer' }))
    orderRepository.seed(buildOrder({ id: 'o1', customerId: 'u1' }))
    await paymentRepository.create({
      orderId: 'o1',
      provider: 'stripe',
      merchantReference: 'ORD-1',
      amount: 1000,
      currency: 'USD',
    })

    const detail = await getAdminOrderDetail('o1', {
      orderRepository,
      userRepository,
      paymentRepository,
    })

    expect(detail).not.toBeNull()
    expect(detail!.order.items).toHaveLength(1)
    expect(detail!.customer).toEqual({ id: 'u1', name: 'Buyer', email: 'buyer@example.com' })
    expect(detail!.payments).toHaveLength(1)
  })

  it('returns null for a missing order id', async () => {
    const orderRepository = new FakeOrderRepository()
    const userRepository = new FakeUserRepository()
    const paymentRepository = new FakePaymentRepository()

    const detail = await getAdminOrderDetail('missing', {
      orderRepository,
      userRepository,
      paymentRepository,
    })

    expect(detail).toBeNull()
  })
})

describe('AdminQueryService — customers', () => {
  it('lists customers with name, email, roles, createdAt — and nothing else', async () => {
    const userRepository = new FakeUserRepository()
    userRepository.seed(buildTestUser({ id: 'u1', email: 'a@example.com', roles: ['customer'] }))

    const rows = await listAdminCustomers({ userRepository })

    expect(rows).toEqual([
      {
        id: 'u1',
        name: 'Test User',
        email: 'a@example.com',
        roles: ['customer'],
        createdAt: rows[0].createdAt,
      },
    ])
  })

  it('customer detail never contains password/auth-internal fields, since the User domain type has none', async () => {
    const userRepository = new FakeUserRepository()
    const orderRepository = new FakeOrderRepository()
    const productRepository = new FakeProductRepository()
    userRepository.seed(buildTestUser({ id: 'u1', email: 'a@example.com' }))

    const detail = await getAdminCustomerDetail('u1', {
      userRepository,
      orderRepository,
      productRepository,
    })

    expect(detail).not.toBeNull()
    const keys = Object.keys(detail!.customer)
    expect(keys).not.toContain('hash')
    expect(keys).not.toContain('salt')
    expect(keys).not.toContain('resetPasswordToken')
    expect(keys).not.toContain('resetPasswordExpiration')
    expect(keys).not.toContain('loginAttempts')
    expect(keys).not.toContain('lockUntil')
  })

  it('customer detail includes their orders and resolved purchases', async () => {
    const userRepository = new FakeUserRepository()
    const orderRepository = new FakeOrderRepository()
    const productRepository = new FakeProductRepository()
    userRepository.seed(
      buildTestUser({ id: 'u1', email: 'a@example.com', purchases: ['p1'] }),
    )
    productRepository.seed(buildTestProduct({ id: 'p1', title: 'Widget', slug: 'widget' }))
    orderRepository.seed({
      id: 'o1',
      orderNumber: 'ORD-1',
      customerId: 'u1',
      items: [],
      subtotal: 0,
      total: 0,
      currency: 'USD',
      status: 'PAID',
      legacyStripePaymentIntentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const detail = await getAdminCustomerDetail('u1', {
      userRepository,
      orderRepository,
      productRepository,
    })

    expect(detail!.orders).toHaveLength(1)
    expect(detail!.purchases).toEqual([{ id: 'p1', title: 'Widget', slug: 'widget' }])
  })

  it('returns null for a missing customer id', async () => {
    const userRepository = new FakeUserRepository()
    const orderRepository = new FakeOrderRepository()
    const productRepository = new FakeProductRepository()

    const detail = await getAdminCustomerDetail('missing', {
      userRepository,
      orderRepository,
      productRepository,
    })

    expect(detail).toBeNull()
  })
})

describe('AdminQueryService — pages', () => {
  it('lists pages with title, slug, status, updatedAt', async () => {
    const pageRepository = new FakePageRepository()
    pageRepository.seed(buildTestPage({ id: 'pg1', title: 'About', slug: 'about' }))

    const rows = await listAdminPages({ pageRepository })

    expect(rows).toEqual([
      {
        id: 'pg1',
        title: 'About',
        slug: 'about',
        status: 'published',
        updatedAt: rows[0].updatedAt,
      },
    ])
  })

  it('page detail returns the full page including layout/meta for JSON display', async () => {
    const pageRepository = new FakePageRepository()
    pageRepository.seed(buildTestPage({ id: 'pg1', layout: [{ blockType: 'content' }] }))

    const page = await getAdminPageDetail('pg1', { pageRepository })

    expect(page).not.toBeNull()
    expect(page!.layout).toEqual([{ blockType: 'content' }])
  })

  it('returns null for a missing page id', async () => {
    const pageRepository = new FakePageRepository()
    const page = await getAdminPageDetail('missing', { pageRepository })
    expect(page).toBeNull()
  })
})

describe('AdminQueryService — media', () => {
  it('lists media with alt, filename, mimeType, url, dimensions, createdAt', async () => {
    const mediaRepository = new FakeMediaRepository()
    mediaRepository.seed(buildTestMedia({ id: 'm1', alt: 'A picture' }))

    const rows = await listAdminMedia({ mediaRepository })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 'm1',
      alt: 'A picture',
      filename: 'test.jpg',
      mimeType: 'image/jpeg',
      url: 'https://example.com/test.jpg',
      width: 800,
      height: 600,
    })
    expect(rows[0].createdAt).toBeInstanceOf(Date)
  })
})
