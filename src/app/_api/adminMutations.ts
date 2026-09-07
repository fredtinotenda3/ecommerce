// src/app/_api/adminMutations.ts
//
// DB-wired entry points for the admin write API. `AdminContentService`
// holds the rules and takes repository interfaces; this file supplies the
// real repositories, and adds the one thing the service cannot own — the
// stored file behind a media record.
//
// Route handlers call only these functions, never a repository directly,
// so validation cannot be bypassed by reaching past the service.

import { deleteStoredFile, storeUpload } from '../../lib/media/storage'
import type { Media } from '../../lib/domain/types'
import * as AdminContentService from '../../lib/services/AdminContentService'
import { AdminValidationError } from '../../lib/services/AdminContentService'
import { getRepositories } from './repositories'

export { AdminValidationError }

// --- Products --------------------------------------------------------------

export const createProduct = async (input: AdminContentService.ProductWriteRequest) => {
  const { products, categories } = await getRepositories()
  return AdminContentService.createProduct(input, {
    productRepository: products,
    categoryRepository: categories,
  })
}

export const updateProduct = async (
  id: string,
  input: AdminContentService.ProductWriteRequest,
) => {
  const { products, categories } = await getRepositories()
  return AdminContentService.updateProduct(id, input, {
    productRepository: products,
    categoryRepository: categories,
  })
}

export const setProductPrice = async (id: string, input: AdminContentService.PriceRequest) => {
  const { products } = await getRepositories()
  return AdminContentService.setProductPrice(id, input, { productRepository: products })
}

export const deleteProduct = async (id: string) => {
  const { products } = await getRepositories()
  return AdminContentService.deleteProduct(id, { productRepository: products })
}

// --- Categories ------------------------------------------------------------

export const createCategory = async (input: AdminContentService.CategoryWriteRequest) => {
  const { categories } = await getRepositories()
  return AdminContentService.createCategory(input, { categoryRepository: categories })
}

export const updateCategory = async (
  id: string,
  input: AdminContentService.CategoryWriteRequest,
) => {
  const { categories } = await getRepositories()
  return AdminContentService.updateCategory(id, input, { categoryRepository: categories })
}

export const deleteCategory = async (id: string) => {
  const { categories, products } = await getRepositories()
  return AdminContentService.deleteCategory(id, {
    categoryRepository: categories,
    productRepository: products,
  })
}

// --- Pages -----------------------------------------------------------------

export const createPage = async (input: AdminContentService.PageWriteRequest) => {
  const { pages } = await getRepositories()
  return AdminContentService.createPage(input, { pageRepository: pages })
}

export const updatePage = async (id: string, input: AdminContentService.PageWriteRequest) => {
  const { pages } = await getRepositories()
  return AdminContentService.updatePage(id, input, { pageRepository: pages })
}

export const deletePage = async (id: string) => {
  const { pages, globals } = await getRepositories()
  return AdminContentService.deletePage(id, { pageRepository: pages, globalsRepository: globals })
}

// --- Media -----------------------------------------------------------------

/** Writes the file first, then the record. If the record write fails the
 * file is removed again, so a failed upload cannot leave an orphan on disk
 * that nothing references and nothing will ever clean up. */
export const uploadMedia = async (input: {
  buffer: Buffer
  originalName: string
  mimeType: string
  alt: string
}): Promise<Media> => {
  const stored = await storeUpload(input.buffer, input.originalName, input.mimeType)

  try {
    const { media } = await getRepositories()
    return await media.create({
      alt: input.alt,
      filename: stored.filename,
      url: stored.url,
      mimeType: stored.mimeType,
      filesize: stored.filesize,
      width: stored.width,
      height: stored.height,
    })
  } catch (error) {
    await deleteStoredFile(stored.filename)
    throw error
  }
}

export const updateMedia = async (id: string, input: { alt?: unknown; caption?: unknown }) => {
  const { media } = await getRepositories()
  return AdminContentService.updateMedia(id, input, { mediaRepository: media })
}

/** Refuses to delete media that something still points at, then removes
 * the record and the file. The reference check is what stops a delete from
 * silently blanking a product image or a nav icon. */
export const deleteMedia = async (id: string): Promise<void> => {
  const { media, products, pages, categories } = await getRepositories()

  const record = await media.getById(id)
  if (!record) throw new AdminValidationError('Media not found.', 404)

  const [allProducts, allPages, allCategories] = await Promise.all([
    products.list({ limit: 1000 }),
    pages.list(),
    categories.list(),
  ])

  const referencedBy = [
    ...allProducts.filter(product => product.meta.imageId === id).map(p => `product "${p.title}"`),
    ...allPages.filter(page => page.meta.imageId === id).map(p => `page "${p.title}"`),
    ...allCategories.filter(category => category.mediaId === id).map(c => `category "${c.title}"`),
  ]

  if (referencedBy.length > 0) {
    throw new AdminValidationError(
      `Still used by ${referencedBy.slice(0, 3).join(', ')}${
        referencedBy.length > 3 ? ` and ${referencedBy.length - 3} more` : ''
      }.`,
      409,
    )
  }

  await media.delete(id)

  if (record.filename) {
    await deleteStoredFile(record.filename)
  }
}

// --- Orders and payments ---------------------------------------------------

export const updateOrderStatus = async (id: string, status: unknown) => {
  const { orders, payments } = await getRepositories()
  return AdminContentService.updateOrderStatus(id, status, {
    orderRepository: orders,
    paymentRepository: payments,
  })
}

export const updatePaymentStatus = async (paymentId: string, status: unknown) => {
  const { payments } = await getRepositories()
  return AdminContentService.updatePaymentStatus(paymentId, status, {
    paymentRepository: payments,
  })
}

// --- Users -----------------------------------------------------------------

export const updateUserRoles = async (id: string, roles: unknown, actingUserId: string) => {
  const { users } = await getRepositories()
  return AdminContentService.updateUserRoles(id, roles, actingUserId, { userRepository: users })
}

// --- Globals ---------------------------------------------------------------

export const saveHeader = async (input: { navItems?: unknown }) => {
  const { globals } = await getRepositories()
  return AdminContentService.saveHeader(input, { globalsRepository: globals })
}

export const saveFooter = async (input: { copyright?: unknown; navItems?: unknown }) => {
  const { globals } = await getRepositories()
  return AdminContentService.saveFooter(input, { globalsRepository: globals })
}

export const saveSettings = async (input: { productsPageId?: unknown }) => {
  const { globals, pages } = await getRepositories()
  return AdminContentService.saveSettings(input, {
    globalsRepository: globals,
    pageRepository: pages,
  })
}

// --- Redirects -------------------------------------------------------------

export const createRedirect = async (input: AdminContentService.RedirectWriteRequest) => {
  const { redirects } = await getRepositories()
  return AdminContentService.createRedirect(input, { redirectRepository: redirects })
}

export const updateRedirect = async (
  id: string,
  input: AdminContentService.RedirectWriteRequest,
) => {
  const { redirects } = await getRepositories()
  return AdminContentService.updateRedirect(id, input, { redirectRepository: redirects })
}

export const deleteRedirect = async (id: string) => {
  const { redirects } = await getRepositories()
  return AdminContentService.deleteRedirect(id, { redirectRepository: redirects })
}
