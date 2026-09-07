// src/lib/services/AdminContentService.ts
//
// The write side of the admin area: validation and the rules that must
// hold no matter which screen or endpoint asked for a change.
//
// Orchestration only. Every function takes repository INTERFACES, so all
// of it is unit-testable against the fakes in `tests/fakes` with no
// database. HTTP concerns (status codes, request parsing) live in the
// route handlers; authorization lives in `requireAdmin`.
//
// Two rules are enforced here rather than at the edge, because they must
// hold for every caller:
//
//   - Slugs are unique per collection and URL-safe. A duplicate slug makes
//     one of the two documents unreachable, and which one wins depends on
//     document order.
//   - Status transitions go through the state machine
//     (orderStateMachine.ts). An order cannot jump from PENDING_PAYMENT to
//     REFUNDED because someone picked it from a dropdown.

import type { Category, Media, Order, Page, Payment, Product, Role, User } from '../domain/types'
import { ORDER_STATUS_TRANSITIONS, PAYMENT_STATUS_TRANSITIONS } from '../domain/types'
import type { OrderStatus, PaymentStatus } from '../domain/types'
import type { CategoryRepository } from '../repositories/CategoryRepository'
import type { GlobalsRepository } from '../repositories/GlobalsRepository'
import type { MediaRepository } from '../repositories/MediaRepository'
import type { OrderRepository } from '../repositories/OrderRepository'
import type { PageRepository, PageWriteInput } from '../repositories/PageRepository'
import type { PaymentRepository } from '../repositories/PaymentRepository'
import type { ProductRepository, ProductWritePatch } from '../repositories/ProductRepository'
import type { RedirectRepository } from '../repositories/RedirectRepository'
import type { UserRepository } from '../repositories/UserRepository'
import { assertValidOrderTransition, assertValidPaymentTransition } from './orderStateMachine'

/** A rejected write, carrying the HTTP status the route should use. The
 * message is written to be shown to an operator: these are all cases the
 * person editing can act on, not internal failures. */
export class AdminValidationError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AdminValidationError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const assertValidSlug = (slug: string): void => {
  if (!SLUG_PATTERN.test(slug)) {
    throw new AdminValidationError(
      'Slug must be lowercase letters, numbers and single hyphens, e.g. "winter-boots".',
    )
  }
}

const requireText = (value: unknown, field: string, max = 500): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AdminValidationError(`${field} is required.`)
  }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    throw new AdminValidationError(`${field} must be ${max} characters or fewer.`)
  }
  return trimmed
}

const optionalText = (value: unknown, field: string, max = 5000): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new AdminValidationError(`${field} must be text.`)
  }
  if (value.length > max) {
    throw new AdminValidationError(`${field} must be ${max} characters or fewer.`)
  }
  return value
}

const optionalId = (value: unknown, field: string): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new AdminValidationError(`${field} must be a valid id.`)
  }
  return value
}

const idList = (value: unknown, field: string): string[] | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new AdminValidationError(`${field} must be a list of ids.`)
  return value.map((entry, index) => {
    const id = optionalId(entry, `${field}[${index}]`)
    if (!id) throw new AdminValidationError(`${field}[${index}] must be a valid id.`)
    return id
  })
}

const blockList = (value: unknown, field: string): unknown[] | undefined => {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) throw new AdminValidationError(`${field} must be a list of blocks.`)
  return value
}

const asStatus = (value: unknown, field: string): 'draft' | 'published' | undefined => {
  if (value === undefined || value === null || value === '') return undefined
  if (value !== 'draft' && value !== 'published') {
    throw new AdminValidationError(`${field} must be "draft" or "published".`)
  }
  return value
}

const parseMeta = (
  value: unknown,
): { title?: string; description?: string; imageId?: string | null } | undefined => {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'object') throw new AdminValidationError('SEO fields must be an object.')

  const meta = value as Record<string, unknown>
  const imageId = optionalId(meta.image ?? meta.imageId, 'SEO image')

  return {
    title: optionalText(meta.title, 'SEO title', 200),
    description: optionalText(meta.description, 'SEO description', 1000),
    imageId: imageId === undefined ? null : imageId,
  }
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductWriteRequest {
  title?: unknown
  slug?: unknown
  status?: unknown
  enablePaywall?: unknown
  categoryIds?: unknown
  relatedProductIds?: unknown
  layout?: unknown
  paywall?: unknown
  meta?: unknown
}

const parseProductPatch = (input: ProductWriteRequest): ProductWritePatch => {
  const patch: ProductWritePatch = {}

  if (input.title !== undefined) patch.title = requireText(input.title, 'Title', 200)
  if (input.slug !== undefined) {
    patch.slug = requireText(input.slug, 'Slug', 200)
    assertValidSlug(patch.slug)
  }
  if (input.status !== undefined) patch.status = asStatus(input.status, 'Status')
  if (input.enablePaywall !== undefined) patch.enablePaywall = Boolean(input.enablePaywall)
  if (input.categoryIds !== undefined) patch.categoryIds = idList(input.categoryIds, 'Categories')
  if (input.relatedProductIds !== undefined) {
    patch.relatedProductIds = idList(input.relatedProductIds, 'Related products')
  }
  if (input.layout !== undefined) patch.layout = blockList(input.layout, 'Layout')
  if (input.paywall !== undefined) patch.paywall = blockList(input.paywall, 'Paywall')
  if (input.meta !== undefined) patch.meta = parseMeta(input.meta)

  return patch
}

/** Rejects a slug already used by a different product. Checked here rather
 * than relying on a unique index, so the operator gets a usable message
 * instead of a duplicate-key error. */
const assertProductSlugAvailable = async (
  slug: string,
  deps: { productRepository: ProductRepository },
  excludingId?: string,
): Promise<void> => {
  const existing = await deps.productRepository.getBySlug(slug)
  if (existing && existing.id !== excludingId) {
    throw new AdminValidationError(`Another product already uses the slug "${slug}".`, 409)
  }
}

/** Referenced categories must exist: a dangling reference renders as a
 * missing chip on the product page and is invisible until a customer sees
 * it. */
const assertCategoriesExist = async (
  categoryIds: string[] | undefined,
  deps: { categoryRepository: CategoryRepository },
): Promise<void> => {
  if (!categoryIds?.length) return

  for (const id of categoryIds) {
    const category = await deps.categoryRepository.getById(id)
    if (!category) throw new AdminValidationError(`Category ${id} does not exist.`)
  }
}

export const createProduct = async (
  input: ProductWriteRequest,
  deps: { productRepository: ProductRepository; categoryRepository: CategoryRepository },
): Promise<Product> => {
  const patch = parseProductPatch(input)

  if (!patch.title) throw new AdminValidationError('Title is required.')
  if (!patch.slug) throw new AdminValidationError('Slug is required.')

  await assertProductSlugAvailable(patch.slug, deps)
  await assertCategoriesExist(patch.categoryIds, deps)

  return deps.productRepository.create({ ...patch, title: patch.title, slug: patch.slug })
}

export const updateProduct = async (
  id: string,
  input: ProductWriteRequest,
  deps: { productRepository: ProductRepository; categoryRepository: CategoryRepository },
): Promise<Product> => {
  const existing = await deps.productRepository.getById(id)
  if (!existing) throw new AdminValidationError('Product not found.', 404)

  const patch = parseProductPatch(input)

  if (patch.slug) await assertProductSlugAvailable(patch.slug, deps, id)
  await assertCategoriesExist(patch.categoryIds, deps)

  const updated = await deps.productRepository.update(id, patch)
  if (!updated) throw new AdminValidationError('Product not found.', 404)
  return updated
}

export interface PriceRequest {
  amount?: unknown
  currency?: unknown
  compareAtPrice?: unknown
}

/** Prices are integers in the currency's minor units. A float here would
 * be a rounding bug that only shows up at the till, so a non-integer is
 * rejected outright rather than rounded. */
export const setProductPrice = async (
  id: string,
  input: PriceRequest,
  deps: { productRepository: ProductRepository },
): Promise<Product> => {
  const amount = input.amount
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0) {
    throw new AdminValidationError(
      'Price must be a whole number of minor units (e.g. 1999 for 19.99), and cannot be negative.',
    )
  }

  if (typeof input.currency !== 'string' || !/^[A-Z]{3}$/.test(input.currency)) {
    throw new AdminValidationError('Currency must be a three-letter ISO code, e.g. USD.')
  }

  let compareAtPrice: number | null = null
  if (input.compareAtPrice !== undefined && input.compareAtPrice !== null && input.compareAtPrice !== '') {
    if (
      typeof input.compareAtPrice !== 'number' ||
      !Number.isInteger(input.compareAtPrice) ||
      input.compareAtPrice < 0
    ) {
      throw new AdminValidationError('Compare-at price must be a whole number of minor units.')
    }
    if (input.compareAtPrice <= amount) {
      throw new AdminValidationError(
        'Compare-at price must be higher than the price, or left empty — it is the struck-through "was" price.',
      )
    }
    compareAtPrice = input.compareAtPrice
  }

  const updated = await deps.productRepository.setPrice(id, {
    amount,
    currency: input.currency,
    compareAtPrice,
  })
  if (!updated) throw new AdminValidationError('Product not found.', 404)
  return updated
}

export const deleteProduct = async (
  id: string,
  deps: { productRepository: ProductRepository },
): Promise<void> => {
  const deleted = await deps.productRepository.delete(id)
  if (!deleted) throw new AdminValidationError('Product not found.', 404)
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface CategoryWriteRequest {
  title?: unknown
  mediaId?: unknown
  parentId?: unknown
}

/** A category cannot be its own ancestor. Without this check a cycle makes
 * any breadcrumb walk loop forever. */
const assertNoCategoryCycle = async (
  id: string,
  parentId: string | null,
  deps: { categoryRepository: CategoryRepository },
): Promise<void> => {
  if (!parentId) return
  if (parentId === id) {
    throw new AdminValidationError('A category cannot be its own parent.')
  }

  const seen = new Set<string>([id])
  let cursor: string | null = parentId

  while (cursor) {
    if (seen.has(cursor)) {
      throw new AdminValidationError('That parent would create a loop in the category tree.')
    }
    seen.add(cursor)

    const parent: Category | null = await deps.categoryRepository.getById(cursor)
    if (!parent) throw new AdminValidationError('Parent category does not exist.')
    cursor = parent.parentId
  }
}

export const createCategory = async (
  input: CategoryWriteRequest,
  deps: { categoryRepository: CategoryRepository },
): Promise<Category> => {
  const title = requireText(input.title, 'Title', 200)
  const mediaId = optionalId(input.mediaId, 'Media')
  const parentId = optionalId(input.parentId, 'Parent')

  if (parentId) {
    const parent = await deps.categoryRepository.getById(parentId)
    if (!parent) throw new AdminValidationError('Parent category does not exist.')
  }

  return deps.categoryRepository.create({
    title,
    mediaId: mediaId ?? null,
    parentId: parentId ?? null,
  })
}

export const updateCategory = async (
  id: string,
  input: CategoryWriteRequest,
  deps: { categoryRepository: CategoryRepository },
): Promise<Category> => {
  const existing = await deps.categoryRepository.getById(id)
  if (!existing) throw new AdminValidationError('Category not found.', 404)

  const patch: { title?: string; mediaId?: string | null; parentId?: string | null } = {}

  if (input.title !== undefined) patch.title = requireText(input.title, 'Title', 200)
  if (input.mediaId !== undefined) patch.mediaId = optionalId(input.mediaId, 'Media') ?? null
  if (input.parentId !== undefined) {
    const parentId = optionalId(input.parentId, 'Parent') ?? null
    await assertNoCategoryCycle(id, parentId, deps)
    patch.parentId = parentId
  }

  const updated = await deps.categoryRepository.update(id, patch)
  if (!updated) throw new AdminValidationError('Category not found.', 404)
  return updated
}

/** Refuses to delete a category still referenced by a product, rather than
 * leaving products pointing at something that no longer exists. The
 * operator is told how many products are in the way. */
export const deleteCategory = async (
  id: string,
  deps: { categoryRepository: CategoryRepository; productRepository: ProductRepository },
): Promise<void> => {
  const inUse = await deps.productRepository.count({ categoryId: id })
  if (inUse > 0) {
    throw new AdminValidationError(
      `${inUse} product(s) still use this category. Remove it from them first.`,
      409,
    )
  }

  const children = (await deps.categoryRepository.list()).filter(c => c.parentId === id)
  if (children.length > 0) {
    throw new AdminValidationError(
      `${children.length} category/categories still have this as their parent.`,
      409,
    )
  }

  const deleted = await deps.categoryRepository.delete(id)
  if (!deleted) throw new AdminValidationError('Category not found.', 404)
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface PageWriteRequest {
  title?: unknown
  slug?: unknown
  status?: unknown
  layout?: unknown
  hero?: unknown
  meta?: unknown
}

const parsePagePatch = (input: PageWriteRequest): Partial<PageWriteInput> => {
  const patch: Partial<PageWriteInput> = {}

  if (input.title !== undefined) patch.title = requireText(input.title, 'Title', 200)
  if (input.slug !== undefined) {
    patch.slug = requireText(input.slug, 'Slug', 200)
    assertValidSlug(patch.slug)
  }
  if (input.status !== undefined) patch.status = asStatus(input.status, 'Status')
  if (input.layout !== undefined) patch.layout = blockList(input.layout, 'Layout')
  if (input.hero !== undefined) {
    if (input.hero !== null && typeof input.hero !== 'object') {
      throw new AdminValidationError('Hero must be an object.')
    }
    patch.hero = input.hero
  }
  if (input.meta !== undefined) patch.meta = parseMeta(input.meta)

  return patch
}

const assertPageSlugAvailable = async (
  slug: string,
  deps: { pageRepository: PageRepository },
  excludingId?: string,
): Promise<void> => {
  const existing = await deps.pageRepository.getBySlug(slug)
  if (existing && existing.id !== excludingId) {
    throw new AdminValidationError(`Another page already uses the slug "${slug}".`, 409)
  }
}

export const createPage = async (
  input: PageWriteRequest,
  deps: { pageRepository: PageRepository },
): Promise<Page> => {
  const patch = parsePagePatch(input)

  if (!patch.title) throw new AdminValidationError('Title is required.')
  if (!patch.slug) throw new AdminValidationError('Slug is required.')

  await assertPageSlugAvailable(patch.slug, deps)

  return deps.pageRepository.create({ ...patch, title: patch.title, slug: patch.slug })
}

export const updatePage = async (
  id: string,
  input: PageWriteRequest,
  deps: { pageRepository: PageRepository },
): Promise<Page> => {
  const existing = await deps.pageRepository.getById(id)
  if (!existing) throw new AdminValidationError('Page not found.', 404)

  const patch = parsePagePatch(input)
  if (patch.slug) await assertPageSlugAvailable(patch.slug, deps, id)

  const updated = await deps.pageRepository.update(id, patch)
  if (!updated) throw new AdminValidationError('Page not found.', 404)
  return updated
}

/** The Settings global's `productsPage` reference is checked before
 * deleting, so the storefront's "continue shopping" link cannot be left
 * pointing at a page that no longer exists. */
export const deletePage = async (
  id: string,
  deps: { pageRepository: PageRepository; globalsRepository: GlobalsRepository },
): Promise<void> => {
  const settings = await deps.globalsRepository.getSettings()
  if (settings?.productsPageId === id) {
    throw new AdminValidationError(
      'This page is set as the products page in Settings. Change that first.',
      409,
    )
  }

  const deleted = await deps.pageRepository.delete(id)
  if (!deleted) throw new AdminValidationError('Page not found.', 404)
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export const updateMedia = async (
  id: string,
  input: { alt?: unknown; caption?: unknown },
  deps: { mediaRepository: MediaRepository },
): Promise<Media> => {
  const patch: { alt?: string; caption?: unknown } = {}

  if (input.alt !== undefined) patch.alt = requireText(input.alt, 'Alt text', 500)
  if (input.caption !== undefined) patch.caption = input.caption

  const updated = await deps.mediaRepository.update(id, patch)
  if (!updated) throw new AdminValidationError('Media not found.', 404)
  return updated
}

// ---------------------------------------------------------------------------
// Orders and payments
// ---------------------------------------------------------------------------

export const allowedOrderTransitions = (from: OrderStatus): OrderStatus[] =>
  ORDER_STATUS_TRANSITIONS[from] ?? []

export const allowedPaymentTransitions = (from: PaymentStatus): PaymentStatus[] =>
  PAYMENT_STATUS_TRANSITIONS[from] ?? []

/** An operator may move an order along its lifecycle, but only through a
 * transition the state machine allows. Marking an order PAID is
 * deliberately NOT reachable this way when it has an unpaid payment
 * record: payment state is owned by the provider callback, and letting the
 * admin overrule it would let a mis-click ship goods that were never paid
 * for. */
export const updateOrderStatus = async (
  id: string,
  status: unknown,
  deps: { orderRepository: OrderRepository; paymentRepository: PaymentRepository },
): Promise<Order> => {
  const order = await deps.orderRepository.getById(id)
  if (!order) throw new AdminValidationError('Order not found.', 404)

  if (typeof status !== 'string' || !(status in ORDER_STATUS_TRANSITIONS)) {
    throw new AdminValidationError('Unknown order status.')
  }
  const next = status as OrderStatus

  if (next === 'PAID') {
    const payments = await deps.paymentRepository.getByOrderId(id)
    const isPaid = payments.some(payment => payment.status === 'PAID')
    if (!isPaid) {
      throw new AdminValidationError(
        'An order can only be marked paid once a payment for it has been confirmed by the provider.',
        409,
      )
    }
  }

  try {
    assertValidOrderTransition(order.status, next)
  } catch (error) {
    throw new AdminValidationError(
      `Cannot move an order from ${order.status} to ${next}.`,
      409,
    )
  }

  const updated = await deps.orderRepository.updateStatus(id, next)
  if (!updated) throw new AdminValidationError('Order not found.', 404)
  return updated
}

/** Payment status is normally written by the Paynow callback. This exists
 * for the cases a provider callback cannot express — recording a refund
 * made in Paynow's own dashboard, or cancelling a payment that will never
 * complete — and is still bound by the same state machine. */
export const updatePaymentStatus = async (
  paymentId: string,
  status: unknown,
  deps: { paymentRepository: PaymentRepository },
): Promise<Payment> => {
  const payment = await deps.paymentRepository.getById(paymentId)
  if (!payment) throw new AdminValidationError('Payment not found.', 404)

  if (typeof status !== 'string' || !(status in PAYMENT_STATUS_TRANSITIONS)) {
    throw new AdminValidationError('Unknown payment status.')
  }
  const next = status as PaymentStatus

  try {
    assertValidPaymentTransition(payment.status, next)
  } catch (error) {
    throw new AdminValidationError(
      `Cannot move a payment from ${payment.status} to ${next}.`,
      409,
    )
  }

  const updated = await deps.paymentRepository.updateStatus(paymentId, next)
  if (!updated) throw new AdminValidationError('Payment not found.', 404)
  return updated
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const VALID_ROLES: Role[] = ['admin', 'customer']

/** Role changes have two guards that exist to keep an operator from
 * locking everyone out: you cannot remove your own admin role, and the
 * last remaining admin cannot be demoted. Both are checked against the
 * database rather than the request. */
export const updateUserRoles = async (
  id: string,
  roles: unknown,
  actingUserId: string,
  deps: { userRepository: UserRepository },
): Promise<User> => {
  const user = await deps.userRepository.getById(id)
  if (!user) throw new AdminValidationError('User not found.', 404)

  if (!Array.isArray(roles) || roles.length === 0) {
    throw new AdminValidationError('At least one role is required.')
  }

  const requested = Array.from(new Set(roles)) as Role[]
  for (const role of requested) {
    if (!VALID_ROLES.includes(role)) {
      throw new AdminValidationError(`Unknown role "${String(role)}".`)
    }
  }

  const losesAdmin = user.roles.includes('admin') && !requested.includes('admin')

  if (losesAdmin && id === actingUserId) {
    throw new AdminValidationError(
      'You cannot remove your own admin role. Ask another administrator to do it.',
      409,
    )
  }

  if (losesAdmin) {
    const admins = await deps.userRepository.list({ role: 'admin', limit: 2 })
    if (admins.length <= 1) {
      throw new AdminValidationError(
        'This is the only administrator. Promote someone else first.',
        409,
      )
    }
  }

  const updated = await deps.userRepository.updateRoles(id, requested)
  if (!updated) throw new AdminValidationError('User not found.', 404)
  return updated
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

export interface NavItemRequest {
  type?: unknown
  label?: unknown
  url?: unknown
  referencePageId?: unknown
  iconMediaId?: unknown
  newTab?: unknown
}

/** A nav item is either a reference to a page or a custom url, never both.
 * Storing both would leave the rendered href depending on which branch the
 * link component checks first. */
const parseNavItems = (value: unknown): { link: NavLinkShape }[] => {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new AdminValidationError('Nav items must be a list.')

  return value.map((raw, index) => {
    const item = (raw ?? {}) as NavItemRequest
    const label = requireText(item.label, `Nav item ${index + 1} label`, 100)
    const type = item.type === 'reference' ? 'reference' : 'custom'

    if (type === 'reference') {
      const referencePageId = optionalId(item.referencePageId, `Nav item ${index + 1} page`)
      if (!referencePageId) {
        throw new AdminValidationError(`Nav item ${index + 1} must link to a page.`)
      }
      return {
        link: {
          type,
          label,
          newTab: Boolean(item.newTab),
          url: null,
          referencePageId,
          referenceRelationTo: 'pages' as const,
          iconMediaId: optionalId(item.iconMediaId, `Nav item ${index + 1} icon`) ?? null,
        },
      }
    }

    const url = requireText(item.url, `Nav item ${index + 1} url`, 500)

    return {
      link: {
        type,
        label,
        newTab: Boolean(item.newTab),
        url,
        referencePageId: null,
        referenceRelationTo: null,
        iconMediaId: optionalId(item.iconMediaId, `Nav item ${index + 1} icon`) ?? null,
      },
    }
  })
}

/** Mirrors the domain `NavLink` shape without importing it under a second
 * name — kept local because only this module builds one. */
interface NavLinkShape {
  type: 'reference' | 'custom'
  label: string | null
  newTab: boolean
  url: string | null
  referencePageId: string | null
  referenceRelationTo: 'pages' | null
  iconMediaId: string | null
}

export const saveHeader = async (
  input: { navItems?: unknown },
  deps: { globalsRepository: GlobalsRepository },
) => deps.globalsRepository.saveHeader({ navItems: parseNavItems(input.navItems) })

export const saveFooter = async (
  input: { copyright?: unknown; navItems?: unknown },
  deps: { globalsRepository: GlobalsRepository },
) =>
  deps.globalsRepository.saveFooter({
    copyright: optionalText(input.copyright, 'Copyright', 500) ?? null,
    navItems: parseNavItems(input.navItems),
  })

export const saveSettings = async (
  input: { productsPageId?: unknown },
  deps: { globalsRepository: GlobalsRepository; pageRepository: PageRepository },
) => {
  const productsPageId = optionalId(input.productsPageId, 'Products page') ?? null

  if (productsPageId) {
    const page = await deps.pageRepository.getById(productsPageId)
    if (!page) throw new AdminValidationError('That page does not exist.')
  }

  return deps.globalsRepository.saveSettings({ productsPageId })
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export interface RedirectWriteRequest {
  from?: unknown
  to?: unknown
  permanent?: unknown
  enabled?: unknown
}

/** `from` must be a root-relative path on this site. `to` may also be an
 * absolute http(s) URL, for moving a page to another domain. Anything else
 * — a protocol-relative `//evil.example`, a `javascript:` url — is
 * rejected: a redirect is a place an attacker would like to put one. */
const parseRedirectTarget = (value: unknown, field: string): string => {
  const raw = requireText(value, field, 2000)

  if (raw.startsWith('//')) {
    throw new AdminValidationError(`${field} must start with "/" or be a full http(s) URL.`)
  }

  if (raw.startsWith('/')) return raw

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new AdminValidationError(`${field} must start with "/" or be a full http(s) URL.`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AdminValidationError(`${field} must use http or https.`)
  }

  return raw
}

const parseRedirectSource = (value: unknown): string => {
  const raw = requireText(value, 'From', 2000)
  if (!raw.startsWith('/') || raw.startsWith('//')) {
    throw new AdminValidationError('From must be a path on this site, starting with "/".')
  }
  return raw
}

export const createRedirect = async (
  input: RedirectWriteRequest,
  deps: { redirectRepository: RedirectRepository },
) => {
  const from = parseRedirectSource(input.from)
  const to = parseRedirectTarget(input.to, 'To')

  if (from === to) throw new AdminValidationError('A redirect cannot point at itself.')

  const existing = await deps.redirectRepository.getByFrom(from)
  if (existing) {
    throw new AdminValidationError(`A redirect from "${from}" already exists.`, 409)
  }

  return deps.redirectRepository.create({
    from,
    to,
    permanent: Boolean(input.permanent),
    enabled: input.enabled === undefined ? true : Boolean(input.enabled),
  })
}

export const updateRedirect = async (
  id: string,
  input: RedirectWriteRequest,
  deps: { redirectRepository: RedirectRepository },
) => {
  const existing = await deps.redirectRepository.getById(id)
  if (!existing) throw new AdminValidationError('Redirect not found.', 404)

  const patch: { from?: string; to?: string; permanent?: boolean; enabled?: boolean } = {}

  if (input.from !== undefined) {
    patch.from = parseRedirectSource(input.from)
    const clash = await deps.redirectRepository.getByFrom(patch.from)
    if (clash && clash.id !== id) {
      throw new AdminValidationError(`A redirect from "${patch.from}" already exists.`, 409)
    }
  }
  if (input.to !== undefined) patch.to = parseRedirectTarget(input.to, 'To')
  if (input.permanent !== undefined) patch.permanent = Boolean(input.permanent)
  if (input.enabled !== undefined) patch.enabled = Boolean(input.enabled)

  const from = patch.from ?? existing.from
  const to = patch.to ?? existing.to
  if (from === to) throw new AdminValidationError('A redirect cannot point at itself.')

  const updated = await deps.redirectRepository.update(id, patch)
  if (!updated) throw new AdminValidationError('Redirect not found.', 404)
  return updated
}

export const deleteRedirect = async (
  id: string,
  deps: { redirectRepository: RedirectRepository },
): Promise<void> => {
  const deleted = await deps.redirectRepository.delete(id)
  if (!deleted) throw new AdminValidationError('Redirect not found.', 404)
}
