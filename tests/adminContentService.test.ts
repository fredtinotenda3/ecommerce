// tests/adminContentService.test.ts
//
// The admin write rules, against in-memory fakes — no database.
//
// These cover the cases where a wrong answer is expensive: a duplicate
// slug that makes a page unreachable, a price stored as a float, a status
// jump the payment state never justified, and an operator locking every
// administrator out of the site.

import { beforeEach, describe, expect, it } from 'vitest'

import {
  AdminValidationError,
  createCategory,
  createPage,
  createProduct,
  createRedirect,
  deleteCategory,
  deletePage,
  saveSettings,
  setProductPrice,
  updateCategory,
  updateOrderStatus,
  updatePaymentStatus,
  updateProduct,
  updateUserRoles,
} from '../src/lib/services/AdminContentService'
import { FakeCategoryRepository, buildTestCategory } from './fakes/FakeCategoryRepository'
import { FakeGlobalsRepository } from './fakes/FakeGlobalsRepository'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakePageRepository, buildTestPage } from './fakes/FakePageRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'
import { FakeUserRepository, buildTestUser } from './fakes/FakeUserRepository'
import type { Order } from '../src/lib/domain/types'

const buildOrder = (overrides: Partial<Order> = {}): Order => ({
  id: 'order1',
  orderNumber: 'ORD-260101-AAAA1111',
  customerId: 'customer1',
  items: [{ productId: 'p1', title: 'Widget', unitPrice: 1000, currency: 'USD', quantity: 1 }],
  subtotal: 1000,
  total: 1000,
  currency: 'USD',
  status: 'PENDING_PAYMENT',
  legacyStripePaymentIntentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('product writes', () => {
  let productRepository: FakeProductRepository
  let categoryRepository: FakeCategoryRepository

  beforeEach(() => {
    productRepository = new FakeProductRepository()
    categoryRepository = new FakeCategoryRepository()
  })

  const deps = () => ({ productRepository, categoryRepository })

  it('creates a draft product with no price — an unpriced product is not purchasable', async () => {
    const product = await createProduct({ title: 'Boots', slug: 'boots' }, deps())

    expect(product.status).toBe('draft')
    expect(product.price).toBeNull()
    expect(product.currency).toBeNull()
  })

  it('rejects a slug that is not URL-safe', async () => {
    await expect(createProduct({ title: 'Boots', slug: 'Winter Boots!' }, deps())).rejects.toThrow(
      AdminValidationError,
    )
  })

  it('rejects a slug already used by another product', async () => {
    productRepository.seed(buildTestProduct({ id: 'p1', slug: 'boots' }))

    await expect(createProduct({ title: 'Other', slug: 'boots' }, deps())).rejects.toThrow(
      /already uses the slug/,
    )
  })

  it('allows a product to keep its own slug when edited', async () => {
    productRepository.seed(buildTestProduct({ id: 'p1', slug: 'boots', title: 'Boots' }))

    const updated = await updateProduct('p1', { slug: 'boots', title: 'Boots II' }, deps())

    expect(updated.title).toBe('Boots II')
  })

  it('rejects a category that does not exist rather than storing a dangling reference', async () => {
    productRepository.seed(buildTestProduct({ id: 'p1' }))

    await expect(
      updateProduct('p1', { categoryIds: ['507f1f77bcf86cd799439011'] }, deps()),
    ).rejects.toThrow(/does not exist/)
  })

  it('accepts a category that exists', async () => {
    categoryRepository.seed(
      buildTestCategory({ id: '507f1f77bcf86cd799439011', title: 'Footwear' }),
    )
    productRepository.seed(buildTestProduct({ id: 'p1' }))

    const updated = await updateProduct(
      'p1',
      { categoryIds: ['507f1f77bcf86cd799439011'] },
      deps(),
    )

    expect(updated.categories).toEqual(['507f1f77bcf86cd799439011'])
  })

  it('clears categories when given an empty list', async () => {
    productRepository.seed(buildTestProduct({ id: 'p1', categories: ['c1'] }))

    const updated = await updateProduct('p1', { categoryIds: [] }, deps())

    expect(updated.categories).toEqual([])
  })
})

describe('setProductPrice', () => {
  let productRepository: FakeProductRepository

  beforeEach(() => {
    productRepository = new FakeProductRepository()
    productRepository.seed(buildTestProduct({ id: 'p1' }))
  })

  const deps = () => ({ productRepository })

  it('stores an integer amount in minor units', async () => {
    const product = await setProductPrice('p1', { amount: 1999, currency: 'USD' }, deps())

    expect(product.price).toBe(1999)
    expect(product.currency).toBe('USD')
  })

  it('rejects a fractional amount rather than rounding it', async () => {
    await expect(
      setProductPrice('p1', { amount: 19.99, currency: 'USD' }, deps()),
    ).rejects.toThrow(/whole number/)
  })

  it('rejects a negative amount', async () => {
    await expect(setProductPrice('p1', { amount: -1, currency: 'USD' }, deps())).rejects.toThrow(
      AdminValidationError,
    )
  })

  it('rejects a currency that is not a three-letter code', async () => {
    await expect(
      setProductPrice('p1', { amount: 100, currency: 'dollars' }, deps()),
    ).rejects.toThrow(/three-letter/)
  })

  it('rejects a compare-at price that is not higher than the price', async () => {
    await expect(
      setProductPrice('p1', { amount: 1999, currency: 'USD', compareAtPrice: 999 }, deps()),
    ).rejects.toThrow(/higher than the price/)
  })

  it('accepts a compare-at price above the price', async () => {
    const product = await setProductPrice(
      'p1',
      { amount: 1999, currency: 'USD', compareAtPrice: 2999 },
      deps(),
    )

    expect(product.compareAtPrice).toBe(2999)
  })
})

describe('category writes', () => {
  let categoryRepository: FakeCategoryRepository
  let productRepository: FakeProductRepository

  beforeEach(() => {
    categoryRepository = new FakeCategoryRepository()
    productRepository = new FakeProductRepository()
  })

  it('refuses to make a category its own parent', async () => {
    categoryRepository.seed(buildTestCategory({ id: 'c1', title: 'Shoes' }))

    await expect(
      updateCategory('c1', { parentId: 'c1' }, { categoryRepository }),
    ).rejects.toThrow(/valid id|own parent/)
  })

  it('refuses a parent change that would create a loop', async () => {
    categoryRepository.seed(buildTestCategory({ id: '507f1f77bcf86cd799439011', title: 'A' }))
    categoryRepository.seed(
      buildTestCategory({
        id: '507f1f77bcf86cd799439012',
        title: 'B',
        parentId: '507f1f77bcf86cd799439011',
      }),
    )

    await expect(
      updateCategory(
        '507f1f77bcf86cd799439011',
        { parentId: '507f1f77bcf86cd799439012' },
        { categoryRepository },
      ),
    ).rejects.toThrow(/loop/)
  })

  it('refuses to delete a category still used by a product', async () => {
    categoryRepository.seed(buildTestCategory({ id: 'c1', title: 'Shoes' }))
    productRepository.seed(buildTestProduct({ id: 'p1', categories: ['c1'] }))

    await expect(deleteCategory('c1', { categoryRepository, productRepository })).rejects.toThrow(
      /still use this category/,
    )
  })

  it('refuses to delete a category that still has children', async () => {
    categoryRepository.seed(buildTestCategory({ id: 'c1', title: 'Shoes' }))
    categoryRepository.seed(buildTestCategory({ id: 'c2', title: 'Boots', parentId: 'c1' }))

    await expect(deleteCategory('c1', { categoryRepository, productRepository })).rejects.toThrow(
      /parent/,
    )
  })

  it('deletes an unreferenced category', async () => {
    categoryRepository.seed(buildTestCategory({ id: 'c1', title: 'Shoes' }))

    await deleteCategory('c1', { categoryRepository, productRepository })

    expect(await categoryRepository.getById('c1')).toBeNull()
  })

  it('requires a title', async () => {
    await expect(createCategory({ title: '   ' }, { categoryRepository })).rejects.toThrow(
      /Title is required/,
    )
  })
})

describe('page writes', () => {
  let pageRepository: FakePageRepository
  let globalsRepository: FakeGlobalsRepository

  beforeEach(() => {
    pageRepository = new FakePageRepository()
    globalsRepository = new FakeGlobalsRepository()
  })

  it('rejects a duplicate slug', async () => {
    pageRepository.seed(buildTestPage({ id: 'page1', slug: 'about' }))

    await expect(createPage({ title: 'About', slug: 'about' }, { pageRepository })).rejects.toThrow(
      /already uses the slug/,
    )
  })

  it('refuses to delete the page Settings points at', async () => {
    pageRepository.seed(buildTestPage({ id: 'page1', slug: 'products' }))
    await globalsRepository.saveSettings({ productsPageId: 'page1' })

    await expect(deletePage('page1', { pageRepository, globalsRepository })).rejects.toThrow(
      /products page in Settings/,
    )
  })

  it('deletes a page nothing points at', async () => {
    pageRepository.seed(buildTestPage({ id: 'page1', slug: 'about' }))

    await deletePage('page1', { pageRepository, globalsRepository })

    expect(await pageRepository.getById('page1')).toBeNull()
  })

  it('rejects a products page setting that names a page which does not exist', async () => {
    await expect(
      saveSettings(
        { productsPageId: '507f1f77bcf86cd799439011' },
        { globalsRepository, pageRepository },
      ),
    ).rejects.toThrow(/does not exist/)
  })
})

describe('order and payment status', () => {
  let orderRepository: FakeOrderRepository
  let paymentRepository: FakePaymentRepository

  beforeEach(() => {
    orderRepository = new FakeOrderRepository()
    paymentRepository = new FakePaymentRepository()
  })

  const deps = () => ({ orderRepository, paymentRepository })

  it('refuses to mark an order paid with no confirmed payment', async () => {
    orderRepository.seed(buildOrder({ status: 'PENDING_PAYMENT' }))

    await expect(updateOrderStatus('order1', 'PAID', deps())).rejects.toThrow(
      /confirmed by the provider/,
    )
  })

  it('allows PAID once the provider has confirmed a payment', async () => {
    orderRepository.seed(buildOrder({ status: 'PENDING_PAYMENT' }))
    const payment = await paymentRepository.create({
      orderId: 'order1',
      provider: 'paynow',
      merchantReference: 'ORD-260101-AAAA1111',
      amount: 1000,
      currency: 'USD',
    })
    await paymentRepository.updateStatus(payment.id, 'PAID')

    const order = await updateOrderStatus('order1', 'PAID', deps())

    expect(order.status).toBe('PAID')
  })

  it('rejects a transition the state machine does not allow', async () => {
    orderRepository.seed(buildOrder({ status: 'PENDING_PAYMENT' }))

    await expect(updateOrderStatus('order1', 'FULFILLED', deps())).rejects.toThrow(/Cannot move/)
  })

  it('rejects an unknown status', async () => {
    orderRepository.seed(buildOrder())

    await expect(updateOrderStatus('order1', 'NOT_A_STATUS', deps())).rejects.toThrow(/Unknown/)
  })

  it('rejects an invalid payment transition', async () => {
    const payment = await paymentRepository.create({
      orderId: 'order1',
      provider: 'paynow',
      merchantReference: 'ref-1',
      amount: 1000,
      currency: 'USD',
    })
    await paymentRepository.updateStatus(payment.id, 'PAID')

    await expect(
      updatePaymentStatus(payment.id, 'PENDING', { paymentRepository }),
    ).rejects.toThrow(/Cannot move a payment/)
  })

  it('allows a refund to be recorded against a paid payment', async () => {
    const payment = await paymentRepository.create({
      orderId: 'order1',
      provider: 'paynow',
      merchantReference: 'ref-2',
      amount: 1000,
      currency: 'USD',
    })
    await paymentRepository.updateStatus(payment.id, 'PAID')

    const updated = await updatePaymentStatus(payment.id, 'REFUNDED', { paymentRepository })

    expect(updated.status).toBe('REFUNDED')
  })
})

describe('updateUserRoles', () => {
  let userRepository: FakeUserRepository

  beforeEach(() => {
    userRepository = new FakeUserRepository()
  })

  it('refuses to let an admin remove their own admin role', async () => {
    userRepository.seed(buildTestUser({ id: 'admin1', roles: ['admin'] }))

    await expect(
      updateUserRoles('admin1', ['customer'], 'admin1', { userRepository }),
    ).rejects.toThrow(/your own admin role/)
  })

  it('demotes one admin while another remains', async () => {
    userRepository.seed(buildTestUser({ id: 'admin1', roles: ['admin'] }))
    userRepository.seed(buildTestUser({ id: 'admin2', roles: ['admin'] }))

    const updated = await updateUserRoles('admin1', ['customer'], 'admin2', { userRepository })

    expect(updated.roles).toEqual(['customer'])
  })

  it('refuses to demote the last remaining admin', async () => {
    userRepository.seed(buildTestUser({ id: 'solo', roles: ['admin'] }))
    userRepository.seed(buildTestUser({ id: 'shopper', roles: ['customer'] }))

    await expect(
      updateUserRoles('solo', ['customer'], 'shopper', { userRepository }),
    ).rejects.toThrow(/only administrator/)
  })

  it('promotes a customer to admin', async () => {
    userRepository.seed(buildTestUser({ id: 'admin1', roles: ['admin'] }))
    userRepository.seed(buildTestUser({ id: 'shopper', roles: ['customer'] }))

    const updated = await updateUserRoles('shopper', ['customer', 'admin'], 'admin1', {
      userRepository,
    })

    expect(updated.roles).toContain('admin')
  })

  it('rejects an unknown role', async () => {
    userRepository.seed(buildTestUser({ id: 'shopper', roles: ['customer'] }))

    await expect(
      updateUserRoles('shopper', ['superuser'], 'admin1', { userRepository }),
    ).rejects.toThrow(/Unknown role/)
  })

  it('rejects an empty role list', async () => {
    userRepository.seed(buildTestUser({ id: 'shopper', roles: ['customer'] }))

    await expect(updateUserRoles('shopper', [], 'admin1', { userRepository })).rejects.toThrow(
      /At least one role/,
    )
  })
})

describe('redirect writes', () => {
  const buildRepository = () => {
    const rows = new Map<string, { id: string; from: string; to: string; permanent: boolean; enabled: boolean; createdAt: Date; updatedAt: Date }>()
    let counter = 0

    return {
      rows,
      async getById(id: string) {
        return rows.get(id) ?? null
      },
      async getByFrom(from: string) {
        return Array.from(rows.values()).find(row => row.from === from) ?? null
      },
      async list() {
        return Array.from(rows.values())
      },
      async create(input: { from: string; to: string; permanent?: boolean; enabled?: boolean }) {
        const row = {
          id: `r${++counter}`,
          from: input.from,
          to: input.to,
          permanent: input.permanent ?? false,
          enabled: input.enabled ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        rows.set(row.id, row)
        return row
      },
      async update() {
        return null
      },
      async delete() {
        return true
      },
    }
  }

  it('accepts a root-relative path', async () => {
    const redirectRepository = buildRepository()

    const redirect = await createRedirect(
      { from: '/old', to: '/new' },
      { redirectRepository },
    )

    expect(redirect.from).toBe('/old')
    expect(redirect.permanent).toBe(false)
  })

  it('accepts an absolute https target', async () => {
    const redirectRepository = buildRepository()

    const redirect = await createRedirect(
      { from: '/old', to: 'https://example.com/new' },
      { redirectRepository },
    )

    expect(redirect.to).toBe('https://example.com/new')
  })

  it('rejects a protocol-relative target, which would leave the site silently', async () => {
    const redirectRepository = buildRepository()

    await expect(
      createRedirect({ from: '/old', to: '//evil.example' }, { redirectRepository }),
    ).rejects.toThrow(/full http/)
  })

  it('rejects a javascript: target', async () => {
    const redirectRepository = buildRepository()

    await expect(
      createRedirect({ from: '/old', to: 'javascript:alert(1)' }, { redirectRepository }),
    ).rejects.toThrow(AdminValidationError)
  })

  it('rejects a source that is not a path on this site', async () => {
    const redirectRepository = buildRepository()

    await expect(
      createRedirect({ from: 'https://example.com/old', to: '/new' }, { redirectRepository }),
    ).rejects.toThrow(/path on this site/)
  })

  it('rejects a redirect that points at itself', async () => {
    const redirectRepository = buildRepository()

    await expect(
      createRedirect({ from: '/loop', to: '/loop' }, { redirectRepository }),
    ).rejects.toThrow(/point at itself/)
  })

  it('rejects a duplicate source', async () => {
    const redirectRepository = buildRepository()
    await createRedirect({ from: '/old', to: '/new' }, { redirectRepository })

    await expect(
      createRedirect({ from: '/old', to: '/other' }, { redirectRepository }),
    ).rejects.toThrow(/already exists/)
  })
})
