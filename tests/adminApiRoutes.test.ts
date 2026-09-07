// tests/adminApiRoutes.test.ts
//
// The admin route handlers, end to end within the process: real session
// verification, real authorization, real validation — with the database
// swapped for in-memory fakes.
//
// This is the test that proves the wiring works, not just the pieces. It
// exercises the path a request actually takes (cookie -> requireAdmin ->
// service -> repository -> response), so a route wired to the wrong
// mutation, or one that authorizes but forgets to return, fails here.

import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSessionToken } from '../src/lib/auth/session'
import { FakeAuthUserRepository } from './fakes/FakeAuthUserRepository'
import { FakeCategoryRepository, buildTestCategory } from './fakes/FakeCategoryRepository'
import { FakeGlobalsRepository } from './fakes/FakeGlobalsRepository'
import { FakeMediaRepository } from './fakes/FakeMediaRepository'
import { FakeOrderRepository } from './fakes/FakeOrderRepository'
import { FakePageRepository, buildTestPage } from './fakes/FakePageRepository'
import { FakePaymentRepository } from './fakes/FakePaymentRepository'
import { FakeProductRepository, buildTestProduct } from './fakes/FakeProductRepository'
import { FakeUserRepository, buildTestUser } from './fakes/FakeUserRepository'

process.env.SESSION_SECRET = 'test-secret-not-for-production'

// Uploads in this file write to a real temporary directory: the upload
// path's value is largely in what it does to the filesystem, so mocking
// that away would test nothing.
const mediaDir = mkdtempSync(join(tmpdir(), 'admin-routes-media-'))
process.env.MEDIA_DIR = mediaDir

afterAll(() => {
  rmSync(mediaDir, { recursive: true, force: true })
  delete process.env.MEDIA_DIR
})

/** The session token the mocked `next/headers` will report, set per test. */
let currentToken: string | null = null

const repositories = {
  authUsers: new FakeAuthUserRepository(),
  categories: new FakeCategoryRepository(),
  globals: new FakeGlobalsRepository(),
  media: new FakeMediaRepository(),
  orders: new FakeOrderRepository(),
  pages: new FakePageRepository(),
  payments: new FakePaymentRepository(),
  products: new FakeProductRepository(),
  redirects: {
    getById: async () => null,
    getByFrom: async () => null,
    list: async () => [],
    create: async (input: { from: string; to: string }) => ({
      id: 'redirect1',
      from: input.from,
      to: input.to,
      permanent: false,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    update: async () => null,
    delete: async () => true,
  },
  users: new FakeUserRepository(),
  connection: {} as never,
}

vi.mock('next/headers', () => ({
  cookies: () => ({ get: (name: string) => (name === 'native-session' && currentToken ? { value: currentToken } : undefined) }),
  headers: () => ({ get: () => null }),
}))

vi.mock('../src/app/_api/repositories', () => ({
  getRepositories: async () => repositories,
}))

// Route handlers are imported inside `beforeAll` rather than at the top
// level: the mocks above must be registered first, and a top-level await
// is not available under this project's CommonJS build target.
type RouteHandler = (request: Request, context?: never) => Promise<Response>
type ParamRouteHandler<Params> = (
  request: Request,
  context: { params: Params },
) => Promise<Response>

let createProductRoute: RouteHandler
let updateProductRoute: ParamRouteHandler<{ id: string }>
let deleteProductRoute: ParamRouteHandler<{ id: string }>
let setPriceRoute: ParamRouteHandler<{ id: string }>
let updateUserRoute: ParamRouteHandler<{ id: string }>
let saveGlobalRoute: ParamRouteHandler<{ slug: string }>
let createRedirectRoute: RouteHandler
let uploadMediaRoute: RouteHandler
let updateOrderRoute: ParamRouteHandler<{ id: string }>
let deleteCategoryRoute: ParamRouteHandler<{ id: string }>

beforeAll(async () => {
  createProductRoute = (await import('../src/app/api/admin/products/route')).POST as RouteHandler
  const productDetail = await import('../src/app/api/admin/products/[id]/route')
  updateProductRoute = productDetail.PATCH as ParamRouteHandler<{ id: string }>
  deleteProductRoute = productDetail.DELETE as ParamRouteHandler<{ id: string }>
  setPriceRoute = (await import('../src/app/api/admin/products/[id]/price/route'))
    .PATCH as ParamRouteHandler<{ id: string }>
  updateUserRoute = (await import('../src/app/api/admin/users/[id]/route'))
    .PATCH as ParamRouteHandler<{ id: string }>
  saveGlobalRoute = (await import('../src/app/api/admin/globals/[slug]/route'))
    .PUT as ParamRouteHandler<{ slug: string }>
  createRedirectRoute = (await import('../src/app/api/admin/redirects/route')).POST as RouteHandler
  uploadMediaRoute = (await import('../src/app/api/admin/media/route')).POST as RouteHandler
  updateOrderRoute = (await import('../src/app/api/admin/orders/[id]/route'))
    .PATCH as ParamRouteHandler<{ id: string }>
  deleteCategoryRoute = (await import('../src/app/api/admin/categories/[id]/route'))
    .DELETE as ParamRouteHandler<{ id: string }>
})

const jsonRequest = (body: unknown): Request =>
  new Request('http://localhost/api/admin/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const signInAsAdmin = (): string => {
  const admin = repositories.authUsers.seed({
    id: 'admin-user',
    email: 'admin@example.com',
    roles: ['admin'],
  })
  repositories.users.seed(buildTestUser({ id: admin.id, email: admin.email, roles: ['admin'] }))
  return createSessionToken({ userId: admin.id, roles: admin.roles })
}

const signInAsCustomer = (): string => {
  const customer = repositories.authUsers.seed({
    id: 'customer-user',
    email: 'shopper@example.com',
    roles: ['customer'],
  })
  return createSessionToken({ userId: customer.id, roles: customer.roles })
}

beforeEach(() => {
  currentToken = null
  repositories.authUsers = new FakeAuthUserRepository()
  repositories.categories = new FakeCategoryRepository()
  repositories.globals = new FakeGlobalsRepository()
  repositories.media = new FakeMediaRepository()
  repositories.orders = new FakeOrderRepository()
  repositories.pages = new FakePageRepository()
  repositories.payments = new FakePaymentRepository()
  repositories.products = new FakeProductRepository()
  repositories.users = new FakeUserRepository()
})

describe('authorization', () => {
  it('refuses an anonymous request with 404, not 401', async () => {
    const response = await createProductRoute(jsonRequest({ title: 'X', slug: 'x' }))

    expect(response.status).toBe(404)
  })

  it('refuses a signed-in customer', async () => {
    currentToken = signInAsCustomer()

    const response = await createProductRoute(jsonRequest({ title: 'X', slug: 'x' }))

    expect(response.status).toBe(404)
  })

  it('refuses a tampered token', async () => {
    signInAsAdmin()
    currentToken = 'not.a.real.token'

    const response = await createProductRoute(jsonRequest({ title: 'X', slug: 'x' }))

    expect(response.status).toBe(404)
  })

  it('refuses a session whose user has been deleted', async () => {
    currentToken = createSessionToken({ userId: 'ghost', roles: ['admin'] })

    const response = await createProductRoute(jsonRequest({ title: 'X', slug: 'x' }))

    expect(response.status).toBe(404)
  })

  it('allows an admin', async () => {
    currentToken = signInAsAdmin()

    const response = await createProductRoute(jsonRequest({ title: 'Boots', slug: 'boots' }))

    expect(response.status).toBe(201)
  })
})

describe('product routes', () => {
  beforeEach(() => {
    currentToken = signInAsAdmin()
  })

  it('creates a product and returns it', async () => {
    const response = await createProductRoute(jsonRequest({ title: 'Boots', slug: 'boots' }))
    const body = (await response.json()) as { product: { slug: string; status: string } }

    expect(response.status).toBe(201)
    expect(body.product.slug).toBe('boots')
    expect(body.product.status).toBe('draft')
  })

  it('reports a validation failure with the operator-facing message', async () => {
    const response = await createProductRoute(jsonRequest({ title: 'Boots', slug: 'Not A Slug' }))
    const body = (await response.json()) as { error: string }

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/lowercase letters/)
  })

  it('reports a duplicate slug as a conflict', async () => {
    repositories.products.seed(buildTestProduct({ id: 'p1', slug: 'boots' }))

    const response = await createProductRoute(jsonRequest({ title: 'Other', slug: 'boots' }))

    expect(response.status).toBe(409)
  })

  it('publishes a product', async () => {
    repositories.products.seed(buildTestProduct({ id: 'p1', slug: 'boots', status: 'draft' }))

    const response = await updateProductRoute(jsonRequest({ status: 'published' }), {
      params: { id: 'p1' },
    })
    const body = (await response.json()) as { product: { status: string } }

    expect(response.status).toBe(200)
    expect(body.product.status).toBe('published')
  })

  it('sets a price in minor units', async () => {
    repositories.products.seed(buildTestProduct({ id: 'p1', price: null, currency: null }))

    const response = await setPriceRoute(jsonRequest({ amount: 2500, currency: 'USD' }), {
      params: { id: 'p1' },
    })
    const body = (await response.json()) as { product: { price: number; currency: string } }

    expect(body.product.price).toBe(2500)
    expect(body.product.currency).toBe('USD')
  })

  it('rejects a fractional price through the route as well as the service', async () => {
    repositories.products.seed(buildTestProduct({ id: 'p1' }))

    const response = await setPriceRoute(jsonRequest({ amount: 25.5, currency: 'USD' }), {
      params: { id: 'p1' },
    })

    expect(response.status).toBe(400)
  })

  it('deletes a product', async () => {
    repositories.products.seed(buildTestProduct({ id: 'p1' }))

    const response = await deleteProductRoute(new Request('http://localhost', { method: 'DELETE' }), {
      params: { id: 'p1' },
    })

    expect(response.status).toBe(200)
    expect(await repositories.products.getById('p1')).toBeNull()
  })

  it('404s deleting something that is not there', async () => {
    const response = await deleteProductRoute(new Request('http://localhost', { method: 'DELETE' }), {
      params: { id: 'missing' },
    })

    expect(response.status).toBe(404)
  })

  it('rejects a malformed body', async () => {
    const response = await createProductRoute(
      new Request('http://localhost/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
    )

    expect(response.status).toBe(400)
  })
})

describe('user role route', () => {
  it('takes the acting admin from the session, not the request', async () => {
    currentToken = signInAsAdmin()
    repositories.users.seed(buildTestUser({ id: 'shopper', roles: ['customer'] }))

    const response = await updateUserRoute(
      jsonRequest({ roles: ['customer', 'admin'], actingUserId: 'someone-else' }),
      { params: { id: 'shopper' } },
    )
    const body = (await response.json()) as { user: { roles: string[] } }

    expect(response.status).toBe(200)
    expect(body.user.roles).toContain('admin')
  })

  it('stops an admin demoting themselves', async () => {
    currentToken = signInAsAdmin()

    const response = await updateUserRoute(jsonRequest({ roles: ['customer'] }), {
      params: { id: 'admin-user' },
    })

    expect(response.status).toBe(409)
  })
})

describe('globals route', () => {
  beforeEach(() => {
    currentToken = signInAsAdmin()
  })

  it('saves header nav items', async () => {
    const response = await saveGlobalRoute(
      jsonRequest({ navItems: [{ type: 'custom', label: 'Blog', url: '/blog' }] }),
      { params: { slug: 'header' } },
    )

    expect(response.status).toBe(200)
    expect((await repositories.globals.getHeader())?.navItems).toHaveLength(1)
  })

  it('rejects a reference nav item with no page', async () => {
    const response = await saveGlobalRoute(
      jsonRequest({ navItems: [{ type: 'reference', label: 'Shop' }] }),
      { params: { slug: 'header' } },
    )

    expect(response.status).toBe(400)
  })

  it('404s an unknown global', async () => {
    const response = await saveGlobalRoute(jsonRequest({}), { params: { slug: 'nonsense' } })

    expect(response.status).toBe(404)
  })

  it('validates the products page exists before saving settings', async () => {
    repositories.pages.seed(buildTestPage({ id: '507f1f77bcf86cd799439011', slug: 'shop' }))

    const ok = await saveGlobalRoute(
      jsonRequest({ productsPageId: '507f1f77bcf86cd799439011' }),
      { params: { slug: 'settings' } },
    )
    expect(ok.status).toBe(200)

    const bad = await saveGlobalRoute(
      jsonRequest({ productsPageId: '507f1f77bcf86cd799439099' }),
      { params: { slug: 'settings' } },
    )
    expect(bad.status).toBe(400)
  })
})

describe('redirect route', () => {
  it('rejects an off-site protocol-relative target', async () => {
    currentToken = signInAsAdmin()

    const response = await createRedirectRoute(jsonRequest({ from: '/old', to: '//evil.example' }))

    expect(response.status).toBe(400)
  })

  it('creates a valid redirect', async () => {
    currentToken = signInAsAdmin()

    const response = await createRedirectRoute(jsonRequest({ from: '/old', to: '/new' }))

    expect(response.status).toBe(201)
  })
})

describe('category route wiring', () => {
  it('refuses to delete a category a product still uses', async () => {
    currentToken = signInAsAdmin()
    repositories.categories.seed(buildTestCategory({ id: 'c1', title: 'Shoes' }))
    repositories.products.seed(buildTestProduct({ id: 'p1', categories: ['c1'] }))

    const response = await deleteCategoryRoute(new Request('http://localhost', { method: 'DELETE' }), {
      params: { id: 'c1' },
    })

    expect(response.status).toBe(409)
  })
})

describe('media upload route', () => {
  /** A tiny but structurally valid PNG, so the magic-number check passes. */
  const buildPng = (): Buffer => {
    const buffer = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
    buffer.write('IHDR', 12, 'ascii')
    buffer.writeUInt32BE(120, 16)
    buffer.writeUInt32BE(80, 20)
    return buffer
  }

  const uploadRequest = (file: Blob, filename: string, alt?: string): Request => {
    const form = new FormData()
    form.append('file', file, filename)
    if (alt) form.append('alt', alt)
    return new Request('http://localhost/api/admin/media', { method: 'POST', body: form })
  }

  it('refuses an anonymous upload before reading the file', async () => {
    currentToken = null

    const response = await uploadMediaRoute(
      uploadRequest(new Blob([buildPng()], { type: 'image/png' }), 'photo.png'),
    )

    expect(response.status).toBe(404)
  })

  it('stores an image and records its dimensions', async () => {
    currentToken = signInAsAdmin()

    const response = await uploadMediaRoute(
      uploadRequest(new Blob([buildPng()], { type: 'image/png' }), 'My Photo.png', 'A red square'),
    )
    const body = (await response.json()) as {
      media: { url: string; alt: string; width: number; height: number; filename: string }
    }

    expect(response.status).toBe(201)
    expect(body.media.alt).toBe('A red square')
    expect(body.media.width).toBe(120)
    expect(body.media.height).toBe(80)
    expect(body.media.url).toBe(`/media/${body.media.filename}`)
    expect(body.media.filename).toMatch(/^my-photo-[a-f0-9]{12}\.png$/)
  })

  it('rejects a file whose bytes are not the type it claims', async () => {
    currentToken = signInAsAdmin()

    const response = await uploadMediaRoute(
      uploadRequest(new Blob(['<?php echo 1; ?>'], { type: 'image/png' }), 'shell.png'),
    )

    expect(response.status).toBe(415)
  })

  it('rejects a request with no file', async () => {
    currentToken = signInAsAdmin()

    const response = await uploadMediaRoute(
      new Request('http://localhost/api/admin/media', { method: 'POST', body: new FormData() }),
    )

    expect(response.status).toBe(400)
  })
})

describe('order status route', () => {
  beforeEach(() => {
    currentToken = signInAsAdmin()
  })

  const seedOrder = (status: 'PENDING_PAYMENT' | 'PAID') => {
    repositories.orders.seed({
      id: 'order1',
      orderNumber: 'ORD-260101-AAAA1111',
      customerId: 'customer1',
      items: [{ productId: 'p1', title: 'Widget', unitPrice: 1000, currency: 'USD', quantity: 1 }],
      subtotal: 1000,
      total: 1000,
      currency: 'USD',
      status,
      legacyStripePaymentIntentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  it('refuses to mark an order paid without a confirmed payment', async () => {
    seedOrder('PENDING_PAYMENT')

    const response = await updateOrderRoute(jsonRequest({ status: 'PAID' }), {
      params: { id: 'order1' },
    })

    expect(response.status).toBe(409)
  })

  it('moves a paid order into processing', async () => {
    seedOrder('PAID')

    const response = await updateOrderRoute(jsonRequest({ status: 'PROCESSING' }), {
      params: { id: 'order1' },
    })
    const body = (await response.json()) as { order: { status: string } }

    expect(response.status).toBe(200)
    expect(body.order.status).toBe('PROCESSING')
  })

  it('rejects a request that asks for nothing', async () => {
    seedOrder('PAID')

    const response = await updateOrderRoute(jsonRequest({}), { params: { id: 'order1' } })

    expect(response.status).toBe(400)
  })
})
